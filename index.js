
const qiniu = require('qiniu');

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());

const accessKey = process.env.QINIU_ACCESS_KEY;
const secretKey = process.env.QINIU_SECRET_KEY;
const bucket = 'dazhongruanjian';

const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
const config = new qiniu.conf.Config();
config.zone = qiniu.zone.Zone_as0;

const bucketManager = new qiniu.rs.BucketManager(mac, config);

const listFolders = (prefix) => new Promise((resolve, reject) => {
  bucketManager.listPrefix(bucket, {
    prefix,
    delimiter: '/',
    limit: 1000
  }, (err, body, info) => {
    if (err) return reject(err);
    if (info.statusCode === 200) {
      const folders = (body.commonPrefixes || []).map(p => p.replace(prefix, '').replace(/\/$/, ''));
      resolve(folders);
    } else {
      reject(new Error('列表失败，状态码：' + info.statusCode));
    }
  });
});

const listImages = (prefix) => new Promise((resolve, reject) => {
  bucketManager.listPrefix(bucket, {
    prefix,
    limit: 1000
  }, (err, body, info) => {
    if (err) return reject(err);
    if (info.statusCode === 200) {
      const files = body.items
        .map(item => item.key.replace(prefix, ''))
        .filter(name => name.match(/\.jpg$/i));
      resolve(files.sort());
    } else {
      reject(new Error('列表失败，状态码：' + info.statusCode));
    }
  });
});

app.get('/api/years', async (req, res) => {
  try {
    const years = await listFolders('dazhongruanjian/');
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/issues', async (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: '缺少年份参数' });
  try {
    const issues = await listFolders(`dazhongruanjian/${year}/`);
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pages', async (req, res) => {
  const { year, issue } = req.query;
  if (!year || !issue) return res.status(400).json({ error: '缺少 year 或 issue 参数' });
  try {
const pages = await listImages(`dazhongruanjian/${year}/${issue}/`);
const baseUrl = `https://www.chinesegamearchive.com/${year}/${issue}/`;
return json(200, pages.map(name => baseUrl + name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server started on port', port));
