import { ObjectID } from 'mongodb';

import { db } from 'utils/mongoConnector';
import { pass, fail } from 'utils/res';

export const ADVICE_CATEGORIES = ['PROFESSOR', 'EXAMS', 'ASSIGNMENTS', 'GENERAL'];

export const normalizeCourseCode = (code) => {
  const trimmed = code.trim().toUpperCase().replace(/\s+/g, ' ');

  return {
    code: trimmed,
    codeKey: trimmed.replace(/[^A-Z0-9]/g, '')
  };
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const searchOfficialCourses = async (query, limit = 25) => {
  try {
    const collection = db.collection('officialCourses');
    const normalizedCode = query.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const escapedQuery = escapeRegex(query.trim());

    // match either on the normalized course code prefix (ex: "CS37" -> "CS374") or the title (ex: "algorithms")

    const res = await collection
      .find({
        $or: [{ codeKey: { $regex: `^${escapeRegex(normalizedCode)}` } }, { title: { $regex: escapedQuery, $options: 'i' } }]
      })
      .limit(limit)
      .toArray();

    return pass({
      courses: res
    });
  } catch (error) {
    return fail(error);
  }
};

export const getOfficialCourseByCodeKey = async (codeKey) => {
  try {
    const collection = db.collection('officialCourses');

    const res = await collection.findOne({
      codeKey
    });

    return pass({
      course: res
    });
  } catch (error) {
    return fail(error);
  }
};

export const getCourse = async (_id) => {
  try {
    const collection = db.collection('courses');

    const res = await collection.findOne({
      _id: new ObjectID(_id)
    });

    return pass({
      course: res
    });
  } catch (error) {
    return fail(error);
  }
};

export const createCourseFromOfficial = async ({ officialCourse, creator, createdAt }) => {
  try {
    const collection = db.collection('courses');

    // create the course if no course matches the normalized code, otherwise return the existing one

    const res = await collection.findOneAndUpdate(
      {
        codeKey: officialCourse.codeKey
      },
      {
        $setOnInsert: {
          code: officialCourse.code,
          codeKey: officialCourse.codeKey,
          title: officialCourse.title,
          source: 'OFFICIAL',
          approved: true,
          createdBy: creator,
          createdAt
        }
      },
      {
        upsert: true,
        returnOriginal: false,
        returnNewDocument: true
      }
    );

    return pass({
      course: res.value
    });
  } catch (error) {
    return fail(error);
  }
};

export const createRequestedCourse = async ({ code, codeKey, title, creator, createdAt }) => {
  try {
    const collection = db.collection('courses');

    // create the course if no course matches the normalized code, otherwise return the existing one
    // (this also covers the case where the same course is requested twice - the second request just enrolls)

    const res = await collection.findOneAndUpdate(
      {
        codeKey
      },
      {
        $setOnInsert: {
          code,
          codeKey,
          title,
          source: 'REQUESTED',
          approved: false,
          createdBy: creator,
          createdAt
        }
      },
      {
        upsert: true,
        returnOriginal: false,
        returnNewDocument: true
      }
    );

    return pass({
      course: res.value
    });
  } catch (error) {
    return fail(error);
  }
};

export const approveCourse = async (_id) => {
  try {
    const collection = db.collection('courses');

    const res = await collection.findOneAndUpdate(
      {
        _id: new ObjectID(_id)
      },
      {
        $set: {
          approved: true
        }
      },
      {
        returnOriginal: false,
        returnNewDocument: true
      }
    );

    return pass({
      course: res.value
    });
  } catch (error) {
    return fail(error);
  }
};

export const rejectCourseCascade = async (_id) => {
  try {
    const objectId = new ObjectID(_id);

    // delete atomically on the unapproved filter so a concurrent approve can never be destroyed

    const res = await db.collection('courses').deleteOne({ _id: objectId, approved: false });

    if (res.deletedCount === 0) {
      return pass({
        course: null
      });
    }

    await db.collection('courseEnrollments').deleteMany({ courseId: objectId });
    await db.collection('courseAdvice').deleteMany({ courseId: objectId });

    return pass({
      course: {
        _id
      }
    });
  } catch (error) {
    return fail(error);
  }
};

export const deleteCourseCascade = async (_id) => {
  try {
    const objectId = new ObjectID(_id);

    // delete the course along with any enrollments and advice attached to it

    await db.collection('courses').deleteOne({ _id: objectId });
    await db.collection('courseEnrollments').deleteMany({ courseId: objectId });
    await db.collection('courseAdvice').deleteMany({ courseId: objectId });

    return pass({
      course: {
        _id
      }
    });
  } catch (error) {
    return fail(error);
  }
};

export const getCoursesWithEnrollments = async () => {
  try {
    const collection = db.collection('courses');

    // get all courses with their enrollments attached

    const res = await collection
      .aggregate([
        {
          $lookup: {
            from: 'courseEnrollments',
            localField: '_id',
            foreignField: 'courseId',
            as: 'enrollments'
          }
        }
      ])
      .toArray();

    return pass({
      courses: res
    });
  } catch (error) {
    return fail(error);
  }
};

export const createEnrollment = async ({ courseId, email, term, createdAt }) => {
  try {
    const collection = db.collection('courseEnrollments');

    // create the enrollment if it doesn't already exist for this course, user and term

    const res = await collection.findOneAndUpdate(
      {
        courseId: new ObjectID(courseId),
        email,
        term
      },
      {
        $setOnInsert: {
          courseId: new ObjectID(courseId),
          email,
          term,
          createdAt
        }
      },
      {
        upsert: true,
        returnOriginal: false,
        returnNewDocument: true
      }
    );

    return pass({
      enrollment: res.value
    });
  } catch (error) {
    return fail(error);
  }
};

export const getEnrollment = async (_id) => {
  try {
    const collection = db.collection('courseEnrollments');

    const res = await collection.findOne({
      _id: new ObjectID(_id)
    });

    return pass({
      enrollment: res
    });
  } catch (error) {
    return fail(error);
  }
};

export const deleteEnrollment = async (_id) => {
  try {
    const collection = db.collection('courseEnrollments');

    await collection.deleteOne({
      _id: new ObjectID(_id)
    });

    return pass({
      enrollment: {
        _id
      }
    });
  } catch (error) {
    return fail(error);
  }
};

export const getAdviceByCourse = async (courseId) => {
  try {
    const collection = db.collection('courseAdvice');

    const res = await collection
      .find({
        courseId: new ObjectID(courseId)
      })
      .toArray();

    return pass({
      advice: res
    });
  } catch (error) {
    return fail(error);
  }
};

export const getAdvice = async (_id) => {
  try {
    const collection = db.collection('courseAdvice');

    const res = await collection.findOne({
      _id: new ObjectID(_id)
    });

    return pass({
      advice: res
    });
  } catch (error) {
    return fail(error);
  }
};

export const createAdvice = async (advice) => {
  try {
    const collection = db.collection('courseAdvice');

    const res = await collection.insertOne({
      ...advice,
      courseId: new ObjectID(advice.courseId)
    });

    return pass({
      advice: res.ops[0]
    });
  } catch (error) {
    return fail(error);
  }
};

export const updateAdvice = async (_id, changes) => {
  try {
    const collection = db.collection('courseAdvice');

    const res = await collection.findOneAndUpdate(
      {
        _id: new ObjectID(_id)
      },
      {
        $set: changes
      },
      {
        returnOriginal: false,
        returnNewDocument: true
      }
    );

    return pass({
      advice: res.value
    });
  } catch (error) {
    return fail(error);
  }
};

export const deleteAdvice = async (_id) => {
  try {
    const collection = db.collection('courseAdvice');

    await collection.deleteOne({
      _id: new ObjectID(_id)
    });

    return pass({
      advice: {
        _id
      }
    });
  } catch (error) {
    return fail(error);
  }
};

export const sanitizeAdvice = (advice, requester) => {
  // hide the author of anonymous advice from everyone except the author and privileged users;
  // the term is hidden with it since a one-person term roster on the same card would name the author

  if (advice.anonymous && advice.email !== requester.email && !requester.privileged) {
    return {
      ...advice,
      email: '',
      term: ''
    };
  }

  return advice;
};
