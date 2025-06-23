// index.js（适用于七牛云函数计算平台或 Railway）

const qiniu = require('qiniu');

exports.main_handler = async (event, context) => {
  const method = event.httpMethod || 'GET';
  const query = event.queryString || {};
  const path = event.path || '/';

  const accessKey = process.env.QINIU_ACCESS_KEY;
  const secretKey = process.env.QINIU_SECRET_KEY;
  const bucket = 'dazhongruanjian';

  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  const config = new qiniu.conf.Config();
  config.zone = qiniu.zone.Zone_as0; // 亚太-新加坡

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
          .filter(name => name.match(/\\.jpg$/i));
        resolve(files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
      } else {
        reject(new Error('列表失败，状态码：' + info.statusCode));
      }
    });
  });

  const json = (status, data) => ({
    isBase64Encoded: false,
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  try {
    if (path === '/api/years') {
      const years = await listFolders('dazhongruanjian/');
      return json(200, years);
    } else if (path === '/api/issues') {
      const year = query.year;
      if (!year) return json(400, { error: '缺少年份参数' });
      const issues = await listFolders(`dazhongruanjian/${year}/`);
      return json(200, issues);
    } else if (path === '/api/pages') {
      const year = query.year;
      const issue = query.issue;
      if (!year || !issue) return json(400, { error: '缺少 year 或 issue 参数' });

      const pages = await listImages(`dazhongruanjian/${year}/${issue}/`);
      const baseUrl = `https://www.chinesegamearchive.com/${year}/${issue}/`;
      const fullUrls = pages.map(name => baseUrl + name);
      return json(200, fullUrls);
    } else {
      return json(404, { error: '未找到接口路径' });
    }
  } catch (err) {
    return json(500, { error: err.message });
  }
};
