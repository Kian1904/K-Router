// api/status.js
const { PROVIDERS } = require('./_providers');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json({
    providers: Object.keys(PROVIDERS).map(id => {
      const p = PROVIDERS[id];
      return {
        id: id,
        name: p.name,
        model: p.model,
        configured: Boolean(process.env[p.key]) // Memeriksa ketersediaan API key di server env
      };
    }),
    timestamp: new Date().toISOString()
  });
};
