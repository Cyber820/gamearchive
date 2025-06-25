const express = require('express');
const qiniu = require('qiniu');
const app = express();
const port = process.env.PORT || 3000;

// ✅ CORS 支持：允许来自前端页面的跨域访问
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// ✅ Referer 校验：仅允许通过你的域名访问 API 接口
const allowedReferer = 'https://www.chinesegamearchive.com';
app.use('/api', (req, res, next) => {
  const referer = req.get('referer') || '';
  if (referer.startsWith(allowedReferer)) {
    next();
  } else {
    res.status(403).send('Forbidden: Invalid referer');
  }
});

// 七牛配置
const accessKey = process.env.QINIU_ACCESS_KEY;
const secretKey = process.env.QINIU_SECRET_KEY;
const bucket = 'dazhongruanjian';

const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
const config = new qiniu.conf.Config();
config.zone = qiniu.zone.Zone_as0; // 亚太-新加坡
const bucketManager = new qiniu.rs.BucketManager(mac, config);

// ✅ 列出子文件夹
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

// ✅ 列出图片（按数字顺序）
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
      resolve(files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    } else {
      reject(new Error('列表失败，状态码：' + info.statusCode));
    }
  });
});

// ✅ 获取年份列表
app.get('/api/years', async (req, res) => {
  try {
    const years = await listFolders('dazhongruanjian/');
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ 获取某年份下的期号
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

// ✅ 获取指定期刊下所有图片地址
app.get('/api/pages', async (req, res) => {
  const { year, issue } = req.query;
  if (!year || !issue) return res.status(400).json({ error: '缺少 year 或 issue 参数' });
  try {
    const pages = await listImages(`dazhongruanjian/${year}/${issue}/`);
    const baseUrl = `https://www.chinesegamearchive.com/dazhongruanjian/${year}/${issue}/`;
    res.json(pages.map(name => baseUrl + name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ 根路径测试
app.get('/', (req, res) => {
  res.send('杂志 API 服务运行中');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
