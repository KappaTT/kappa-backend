import middyfy from 'middleware';
import createHttpError from 'http-errors';

import { getCoursesWithEnrollments } from 'services/course';

const _handler = async (event, context) => {
  if (!event.authorized) {
    throw new createHttpError.Unauthorized('Not authorized to view courses');
  }

  const foundCourses = await getCoursesWithEnrollments();

  if (!foundCourses.success) {
    throw new createHttpError.InternalServerError('Could not get courses');
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
