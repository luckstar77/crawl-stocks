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

  let parseDepositStocks = $('#example tbody tr')
    .map((index, stock) => {
      return {
        symbol: $(stock)
          .children('td')
          .eq(0)
          .text(),
        company:
          $(stock)
            .children('td')
            .eq(1)
            .text() ||
          $(stock)
            .children('td')
            .eq(0)
            .text(),
        price: parseFloat(
          $(stock)
            .children('td')
            .eq(3)
            .text(),
        ),
      };
    })
    .get();

  for (let i = 0; i <= parseInt(parseDepositStocks.length / 25); i++) {
    const list = parseDepositStocks.slice(i * 25, (i + 1) * 25);
    if (_.isEmpty(list)) break;

    await new Promise((resolve, reject) => {
      const now = new Date();
      docClient.batchWrite(
        {
          RequestItems: {
            stocks: list.map(o => ({
              PutRequest: {
                Item: {
                  ...o,
                  created: now.getTime(),
                },
              },
            })),
          },
        },
        function(err, data) {
          if (err) {
            console.error(
              'Unable to add item. Error JSON:',
              JSON.stringify(err, null, 2),
            );
            console.log(list);
            reject(err);
          } else {
            // console.log('Added item:', JSON.stringify(data, null, 2));
            resolve(data);
          }
        },
      );
    });
  }
};

exports.handler = async function(event, context) {
  await worker();
  return 'ok';
};
