import middyfy from 'middleware';
import createHttpError from 'http-errors';
import moment from 'moment';
import oc from 'js-optchain';

import { ADVICE_CATEGORIES, createAdvice } from 'services/course';

const _handler = async (event, context) => {
  if (!event.authorized) {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  const ocBody = oc(event.body, {
    advice: {
      courseId: '',
      category: 'GENERAL',
      professor: '',
      text: '',
      anonymous: false
    }
  });

  if (ocBody.advice.courseId === '' || ocBody.advice.text.trim() === '') {
    throw new createHttpError.BadRequest('Missing required fields');
  }

  if (!ADVICE_CATEGORIES.includes(ocBody.advice.category)) {
    throw new createHttpError.BadRequest('Invalid category');
  }

  const newAdvice = {
    courseId: ocBody.advice.courseId,
    email: event.user.email,
    anonymous: ocBody.advice.anonymous === true,
    category: ocBody.advice.category,
    professor: ocBody.advice.professor.trim(),
    text: ocBody.advice.text.trim(),
    createdAt: moment().toISOString(),
    updatedAt: moment().toISOString()
  };

  const createdAdvice = await createAdvice(newAdvice);

  if (!createdAdvice.success) {
    throw new createHttpError.InternalServerError('Could not create advice');
  }

  console.log('Created advice', createdAdvice.data.advice._id);

  return {
    statusCode: 200,
    body: {
      advice: createdAdvice.data.advice
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
