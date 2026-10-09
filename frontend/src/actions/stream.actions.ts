'use server';

import { StreamClient } from '@stream-io/node-sdk';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const apiSecret = process.env.STREAM_SECRET_KEY;

export const tokenProvider = async (userId: string) => {
  if (!apiKey) throw new Error('Stream API Key missing in env');
  if (!apiSecret) throw new Error('Stream Secret Key missing in env');

  const client = new StreamClient(apiKey, apiSecret);

  // Set token validity for 1 hour
  const exp = Math.round(new Date().getTime() / 1000) + 60 * 60;
  const issued = Math.floor(Date.now() / 1000) - 60;

  return client.generateUserToken({
    user_id: userId,
    exp: exp,
    validity_in_seconds: issued,
  });
};