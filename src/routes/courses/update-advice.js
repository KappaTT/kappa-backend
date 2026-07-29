import middyfy from 'middleware';
import createHttpError from 'http-errors';
import moment from 'moment';
import oc from 'js-optchain';

import { ADVICE_CATEGORIES, getAdvice, updateAdvice } from 'services/course';

const _handler = async (event, context) => {
  const target = decodeURIComponent(event.pathParameters?.target);

  if (!event.authorized) {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  if (!target) {
    throw new createHttpError.BadRequest('Invalid target');
  }

  const foundAdvice = await getAdvice(target);

  if (!foundAdvice.success || !foundAdvice.data.advice) {
    throw new createHttpError.BadRequest('Advice not found');
  }

  if (foundAdvice.data.advice.email !== event.user.email) {
    throw new createHttpError.Unauthorized('Not authorized to edit this advice');
  }

  const ocBody = oc(event.body, {
    changes: {
      category: foundAdvice.data.advice.category,
      professor: foundAdvice.data.advice.professor,
      term: foundAdvice.data.advice.term || '',
      text: foundAdvice.data.advice.text,
      anonymous: foundAdvice.data.advice.anonymous
    }
  });

  if (ocBody.changes.text.trim() === '') {
    throw new createHttpError.BadRequest('Missing required fields');
  }

  if (!ADVICE_CATEGORIES.includes(ocBody.changes.category)) {
    throw new createHttpError.BadRequest('Invalid category');
  }

  const updatedAdvice = await updateAdvice(target, {
    category: ocBody.changes.category,
    professor: ocBody.changes.professor.trim(),
    term: ocBody.changes.term.trim(),
    text: ocBody.changes.text.trim(),
    anonymous: ocBody.changes.anonymous === true,
    updatedAt: moment().toISOString()
  });

  if (!updatedAdvice.success) {
    throw new createHttpError.InternalServerError('Could not update advice');
  }

  console.log('Updated advice', target);

  return {
    statusCode: 200,
    body: {
      advice: updatedAdvice.data.advice
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
