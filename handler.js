const AWS = require('aws-sdk');
const moment = require('moment');
const shortstop = require('shortstop');
const handlers = require('shortstop-handlers');
const assert = require('assert');

exports.handleShortStopAndPublish = async (event) => {
  assert(event.queueName, 'Queue name must be provided in the event');
  const { queueName } = event;
  const resolver = shortstop.create();
  resolver.use(handlers.env());
  resolver.use(handlers.base64());
  resolver.use(handlers.exec());
  resolver.use('now', value => moment().format(value));
  resolver.use('relative-date', (value) => {
    const [amount, interval, ...format] = value.split(' ');
    const finalFormat = format.join(' ');
    return moment().add(amount, interval).format(finalFormat);
  });
  const message = await new Promise((accept, reject) => {
    resolver.resolve(event, (error, data) => {
      if (error) {
        reject(error);
      } else {
        delete data.queueName;
        accept(data);
      }
    });
  });
  const queueUrl = `https://sqs.${process.env.region}.amazonaws.com/${process.env.awsAccountId}/${queueName}`;
  const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
  const messageParams = {
    MessageBody: JSON.stringify(message),
    QueueUrl: queueUrl,
  };
  console.log(JSON.stringify(messageParams));
  let returnPublish;
  try {
    returnPublish = await sqs.sendMessage(messageParams).promise();
  } catch (error) {
    return {
      statusCode: 500,
      body: error,
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message,
        input: event,
        messageId: returnPublish.MessageId,
      },
      null,
      2,
    ),
  };
};
