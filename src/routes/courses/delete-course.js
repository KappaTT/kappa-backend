import middyfy from 'middleware';
import createHttpError from 'http-errors';

import { getCourse, deleteCourseCascade } from 'services/course';

const _handler = async (event, context) => {
  const target = decodeURIComponent(event.pathParameters?.target);

  if (!event.authorized || !event.user.privileged || event.user.role?.toLowerCase() !== 'web') {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  if (!target) {
    throw new createHttpError.BadRequest('Invalid target');
  }

  const foundCourse = await getCourse(target);

  if (!foundCourse.success || !foundCourse.data.course) {
    throw new createHttpError.BadRequest('Course not found');
  }

  const deletedCourse = await deleteCourseCascade(target);

  if (!deletedCourse.success) {
    throw new createHttpError.InternalServerError('Could not delete course');
  }

  console.log('Deleted course', target);

  return {
    statusCode: 200,
    body: {
      course: {
        _id: target
      }
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
