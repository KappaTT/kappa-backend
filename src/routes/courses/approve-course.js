import middyfy from 'middleware';
import createHttpError from 'http-errors';

import { getCourse, approveCourse } from 'services/course';

const _handler = async (event, context) => {
  const target = decodeURIComponent(event.pathParameters?.target);

  if (!event.authorized || !event.user.privileged) {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  if (!target) {
    throw new createHttpError.BadRequest('Invalid target');
  }

  const foundCourse = await getCourse(target);

  if (!foundCourse.success || !foundCourse.data.course) {
    throw new createHttpError.BadRequest('Course not found');
  }

  const updatedCourse = await approveCourse(target);

  if (!updatedCourse.success) {
    throw new createHttpError.InternalServerError('Could not approve course');
  }

  console.log('Approved course', target);

  return {
    statusCode: 200,
    body: {
      course: updatedCourse.data.course
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
