module.exports = (req, res) => {
  const key = process.env.OPENWEATHER_API_KEY || '';

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.end(`window.OPENWEATHER_API_KEY = ${JSON.stringify(key)};`);
};
