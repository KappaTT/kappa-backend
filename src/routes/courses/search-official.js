import middyfy from 'middleware';
import createHttpError from 'http-errors';

import { searchOfficialCourses } from 'services/course';

const _handler = async (event, context) => {
  if (!event.authorized) {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  const query = event.queryStringParameters?.q || '';

  if (query.trim().length < 2) {
    // avoid scanning the whole catalog for a single character

    return {
      statusCode: 200,
      body: {
        courses: []
      }
    };
  }

  const foundCourses = await searchOfficialCourses(query);

  if (!foundCourses.success) {
    throw new createHttpError.InternalServerError('Could not search courses');
  }

  return {
    statusCode: 200,
    body: {
      courses: foundCourses.data.courses
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
