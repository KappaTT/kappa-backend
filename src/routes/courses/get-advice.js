import middyfy from 'middleware';
import createHttpError from 'http-errors';

import { getAdviceByCourse, sanitizeAdvice } from 'services/course';

const _handler = async (event, context) => {
  const target = decodeURIComponent(event.pathParameters?.target);

  if (!event.authorized) {
    throw new createHttpError.Unauthorized('Not authorized to view advice');
  }

  if (!target) {
    throw new createHttpError.BadRequest('Invalid target');
  }

  const foundAdvice = await getAdviceByCourse(target);

  if (!foundAdvice.success) {
    throw new createHttpError.InternalServerError('Could not get advice');
  }

  return {
    statusCode: 200,
    body: {
      advice: foundAdvice.data.advice.map((advice) => sanitizeAdvice(advice, event.user))
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
