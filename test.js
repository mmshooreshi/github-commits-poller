import handler from './api/polling.js';

import dotenv from 'dotenv';
dotenv.config();

// Now use your env vars
// console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN);


const req = {};
const res = {
  status: (code) => ({
    json: (data) => {
      console.log('Response:', data);
    }
  })
};

handler(req, res);
