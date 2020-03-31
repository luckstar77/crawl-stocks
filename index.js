const rp = require('request-promise');
const cheerio = require('cheerio');
const _ = require('lodash');

const AWS = require('aws-sdk');

AWS.config.update({
  region: 'ap-northeast-1',
});

var docClient = new AWS.DynamoDB.DocumentClient();

const worker = async () => {
  let $ = cheerio.load(
    await rp({
      uri: 'https://stock.wespai.com/p/57193',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36',
      },
      json: true,
    }),
  );

  let stocks = _.map($('#example tbody tr'), stock => ({
    symbol: $(stock)
      .children('td')
      .eq(0)
      .text(),
    company: $(stock)
      .children('td')
      .eq(1)
      .text(),
    price: parseFloat(
      $(stock)
        .children('td')
        .eq(2)
        .text(),
    ),
    dividendYield: parseFloat(
      $(stock)
        .children('td')
        .eq(3)
        .text(),
    ),
    s4eps: parseFloat(
      $(stock)
        .children('td')
        .eq(4)
        .text(),
    ),
    yeps: parseFloat(
      $(stock)
        .children('td')
        .eq(5)
        .text(),
    ),
    y1eps: parseFloat(
      $(stock)
        .children('td')
        .eq(6)
        .text(),
    ),
    y2eps: parseFloat(
      $(stock)
        .children('td')
        .eq(7)
        .text(),
    ),
    mRevenueYoY: parseFloat(
      $(stock)
        .children('td')
        .eq(8)
        .text(),
    ),
    m1RevenueYoY: parseFloat(
      $(stock)
        .children('td')
        .eq(9)
        .text(),
    ),
    m2RevenueYoY: parseFloat(
      $(stock)
        .children('td')
        .eq(10)
        .text(),
    ),
    mCumulativeRevenueYoY: parseFloat(
      $(stock)
        .children('td')
        .eq(11)
        .text(),
    ),
    s4opm: parseFloat(
      $(stock)
        .children('td')
        .eq(12)
        .text(),
    ),
    yopm: parseFloat(
      $(stock)
        .children('td')
        .eq(13)
        .text(),
    ),
    y1opm: parseFloat(
      $(stock)
        .children('td')
        .eq(14)
        .text(),
    ),
    y2opm: parseFloat(
      $(stock)
        .children('td')
        .eq(15)
        .text(),
    ),
    s4nim: parseFloat(
      $(stock)
        .children('td')
        .eq(16)
        .text(),
    ),
    ynim: parseFloat(
      $(stock)
        .children('td')
        .eq(17)
        .text(),
    ),
    y1nim: parseFloat(
      $(stock)
        .children('td')
        .eq(18)
        .text(),
    ),
    y2nim: parseFloat(
      $(stock)
        .children('td')
        .eq(19)
        .text(),
    ),
    cashM: parseFloat(
      $(stock)
        .children('td')
        .eq(20)
        .text(),
    ),
    qr: parseFloat(
      $(stock)
        .children('td')
        .eq(21)
        .text(),
    ),
  }));

  for (let stock of stocks) {
    let result = {};
    let dividendLists = [];
    do {
      result = await new Promise((resolve, reject) => {
        let params = {
          ExpressionAttributeValues: {
            ':symbol': stock.symbol,
          },
          FilterExpression: 'symbol=:symbol',
          TableName: 'dividendLists',
        };
        if (result.LastEvaluatedKey)
          params.ExclusiveStartKey = result.LastEvaluatedKey;
        docClient.scan(params, function(err, data) {
          if (err) {
            console.error(err);
            return resolve(result);
          }
          resolve(data);
        });
      });

      dividendLists = dividendLists.concat(result.Items);
    } while (!_.isEmpty(result.LastEvaluatedKey));
    let dividendCount = 0;
    let cashCount = 0;
    let rightCount = 0;
    let cashRecoveredCount = 0;
    let rightRecoveredCount = 0;
    let cashRecoveredRate = 0;
    let rightRecoveredRate = 0;
    let avgDividendYield = 0;
    let sumDividendYield = 0;

    const dividendList = _.chain(dividendLists)
      .filter({ symbol: stock.symbol })
      .map(dividend => {
        dividendCount++;
        sumDividendYield += dividend.dividendYield;

        if (dividend.cashTotal > 0) cashCount++;
        if (dividend.rightTotal > 0) rightCount++;
        if (dividend.cashRecoveredDay && dividend.cashRecoveredDay <= 366)
          cashRecoveredCount++;
        if (dividend.rightRecoveredDay && dividend.rightRecoveredDay <= 366)
          rightRecoveredCount++;
      })
      .value();

    if (cashCount > 0) cashRecoveredRate = cashRecoveredCount / cashCount;
    if (rightCount > 0) rightRecoveredRate = rightRecoveredCount / rightCount;
    if (dividendCount > 0) avgDividendYield = sumDividendYield / dividendCount;

    const updatedObj = {
      ...stock,
      updated: Date.now(),
      price: stock.price,
      company: stock.company,
      dividendCount,
      cashCount,
      rightCount,
      cashRecoveredCount,
      rightRecoveredCount,
      cashRecoveredRate,
      rightRecoveredRate,
      avgDividendYield,
      sumDividendYield,
    };
    delete updatedObj.symbol;

    let isSave = false;
    do {
      await new Promise((resolve, reject) => {
        docClient.update(
          {
            TableName: 'stocks',
            Key: {
              symbol: stock.symbol,
            },
            UpdateExpression: _.keys(updatedObj)
              .reduce((accu, curr) => `${accu} ${curr}=:${curr},`, 'set ')
              .replace(/,$/, ''),
            ExpressionAttributeValues: _.mapKeys(
              updatedObj,
              (value, key) => `:${key}`,
            ),
            ReturnValues: 'ALL_NEW',
          },
          function(err, data) {
            if (err) {
              console.error(err);
              return resolve();
            }
            isSave = true;
            resolve(data);
          },
        );
      });
    } while (!isSave);
  }
};

exports.handler = async function(event, context) {
  await worker();
  return 'ok';
};
