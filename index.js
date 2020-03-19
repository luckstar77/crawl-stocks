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
      uri: 'https://stock.wespai.com/lists',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36',
      },
      json: true,
    }),
  );

  await Promise.all(
    $('#example tbody tr')
      .map((index, stock) => {
        return new Promise((resolve, reject) => {
          docClient.update(
            {
              TableName: 'stocks',
              Key: {
                symbol: $(stock)
                  .children('td')
                  .eq(0)
                  .text(),
              },
              UpdateExpression:
                'set price=:price, company=:company, updated=:updated',
              ExpressionAttributeValues: {
                ':updated': Date.now(),
                ':price': parseFloat(
                  $(stock)
                    .children('td')
                    .eq(3)
                    .text(),
                ),
                ':company':
                  $(stock)
                    .children('td')
                    .eq(1)
                    .text() ||
                  $(stock)
                    .children('td')
                    .eq(0)
                    .text(),
              },
              ReturnValues: 'ALL_NEW',
            },
            function(err, data) {
              if (err) return reject(err); // an error occurred
              console.log(data);
              resolve(data);
            },
          );
        });
      })
      .get(),
  );
};

exports.handler = async function(event, context) {
  await worker();
  return 'ok';
};
