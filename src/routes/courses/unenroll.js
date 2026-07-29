import middyfy from 'middleware';
import createHttpError from 'http-errors';

import { getEnrollment, deleteEnrollment } from 'services/course';

const _handler = async (event, context) => {
  const target = decodeURIComponent(event.pathParameters?.target);

  if (!event.authorized) {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  if (!target) {
    throw new createHttpError.BadRequest('Invalid target');
  }

  const foundEnrollment = await getEnrollment(target);

  if (!foundEnrollment.success || !foundEnrollment.data.enrollment) {
    throw new createHttpError.BadRequest('Enrollment not found');
  }

  if (foundEnrollment.data.enrollment.email !== event.user.email && !event.user.privileged) {
    throw new createHttpError.Unauthorized('Not authorized to remove this enrollment');
  }

  const deletedEnrollment = await deleteEnrollment(target);

  if (!deletedEnrollment.success) {
    throw new createHttpError.InternalServerError('Could not delete enrollment');
  }

  console.log('Deleted enrollment', target);

  return {
    statusCode: 200,
    body: {
      enrollment: {
        _id: target
      }
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
