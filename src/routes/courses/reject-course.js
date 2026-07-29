import middyfy from 'middleware';
import createHttpError from 'http-errors';

import { getCourse, rejectCourseCascade } from 'services/course';

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

  const rejectedCourse = await rejectCourseCascade(target);

  if (!rejectedCourse.success) {
    throw new createHttpError.InternalServerError('Could not reject course');
  }

  if (!rejectedCourse.data.course) {
    // the atomic filter only matches courses explicitly marked unapproved: legacy docs and courses
    // approved concurrently by another officer both land here instead of being cascade-deleted

    throw new createHttpError.BadRequest('Only pending courses can be rejected');
  }

  console.log('Rejected course', target);

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
