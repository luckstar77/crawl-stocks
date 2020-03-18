# crawl-stocks

找出全台灣所有股票價格

### zip packages

1. zip the node_modules into nodejs(nodejs/node_modules)
2. upload to s3

### zip function

```
zip -r ./crawl-stocks.zip index.js
```

### deploy to lambda

```
aws lambda update-function-code --function-name crawl-stocks --zip-file fileb://crawl-stocks.zip
```
