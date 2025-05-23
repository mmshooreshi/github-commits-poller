// ./test.js
import handler from './api/polling.js';

const req = {};
const res = {
  status: (code) => ({
    json: (data) => console.log(`Response ${code}:`, data)
  })
};

handler(req, res);
