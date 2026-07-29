/**
 * One-off sync of the UIUC course catalog (courses.illinois.edu) into the
 * `officialCourses` collection. This is what the "add a class" flow searches
 * against so members can only pick classes that are actually offered.
 *
 * This is a standalone script (not a Lambda route) since it makes ~300 HTTP
 * requests to a third-party API and is meant to be run by hand occasionally,
 * not on every deploy or app load. Safe to re-run: every course is upserted
 * by its normalized code, so running it again just refreshes titles.
 *
 * Usage:
 *   yarn sync-catalog                 # current term (spring/fall by month)
 *   yarn sync-catalog 2026 fall       # explicit year + term
 */

const fetch = require('node-fetch');
const { parse } = require('fast-xml-parser');
const { MongoClient } = require('mongodb');
const path = require('path');

const secrets = require(path.join(__dirname, '..', 'serverless-config', 'secrets.json'));

const CATALOG_BASE = 'https://courses.illinois.edu/cisapp/explorer/catalog';
const CONCURRENCY = 5;
const DELAY_BETWEEN_BATCHES_MS = 150;

const normalizeCourseCode = (code) => {
  const trimmed = code.trim().toUpperCase().replace(/\s+/g, ' ');

  return {
    code: trimmed,
    codeKey: trimmed.replace(/[^A-Z0-9]/g, '')
  };
};

const asArray = (value) => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

// fast-xml-parser 3.x doesn't decode XML entities in text content, and course titles
// commonly contain "&" (ex: "Algorithms & Models of Computation"), so decode them ourselves

const decodeXMLEntities = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchXML = async (url) => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  const text = await res.text();

  return parse(text, { ignoreAttributes: false, attributeNamePrefix: '@_' });
};

const getDefaultTerm = () => {
  const now = new Date();

  return {
    year: String(now.getFullYear()),
    term: now.getMonth() <= 5 ? 'spring' : 'fall'
  };
};

const main = async () => {
  const [, , yearArg, termArg] = process.argv;
  const { year, term } = yearArg && termArg ? { year: yearArg, term: termArg } : getDefaultTerm();

  console.log(`Syncing UIUC catalog for ${term} ${year}...`);

  const client = await MongoClient.connect(secrets.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  try {
    const db = client.db('ThetaTau');
    const collection = db.collection('officialCourses');

    const termDoc = await fetchXML(`${CATALOG_BASE}/${year}/${term}.xml`);
    const subjects = asArray(termDoc['ns2:term']?.subjects?.subject);

    if (subjects.length === 0) {
      throw new Error(`No subjects found for ${term} ${year} - check the year/term are valid`);
    }

    console.log(`Found ${subjects.length} subjects. Fetching course listings (this takes a few minutes)...\n`);

    let totalCourses = 0;
    let failedSubjects = 0;

    for (let i = 0; i < subjects.length; i += CONCURRENCY) {
      const batch = subjects.slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async (subject) => {
          const subjectId = subject['@_id'];

          try {
            const subjectDoc = await fetchXML(subject['@_href']);
            const courses = asArray(subjectDoc['ns2:subject']?.courses?.course);

            const ops = courses.map((course) => {
              const title = decodeXMLEntities(typeof course === 'object' ? course['#text'] || '' : String(course));
              const { code, codeKey } = normalizeCourseCode(`${subjectId} ${course['@_id']}`);

              return {
                updateOne: {
                  filter: { codeKey },
                  update: {
                    $set: {
                      code,
                      codeKey,
                      title,
                      subjectId,
                      updatedAt: new Date().toISOString()
                    },
                    $setOnInsert: {
                      createdAt: new Date().toISOString()
                    }
                  },
                  upsert: true
                }
              };
            });

            if (ops.length > 0) {
              await collection.bulkWrite(ops, { ordered: false });
              totalCourses += ops.length;
            }

            console.log(`  ${subjectId}: ${ops.length} courses`);
          } catch (error) {
            failedSubjects += 1;
            console.error(`  ${subjectId}: FAILED (${error.message})`);
          }
        })
      );

      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }

    console.log(
      `\nDone. Synced ${totalCourses} courses across ${subjects.length - failedSubjects}/${subjects.length} subjects into 'officialCourses'.`
    );
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
