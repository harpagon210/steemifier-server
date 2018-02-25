# steemifier-server
Server for the Steemifier browser extension

# Installation
* follow this tutorial to setup serverless and an aws lambda account [https://hackernoon.com/a-crash-course-on-serverless-with-node-js-632b37d58b44](https://hackernoon.com/a-crash-course-on-serverless-with-node-js-632b37d58b44)


* Clone the repository

* Open a command line

* execute `npm install`

# Development
* execute `npm run build:dev` to start the development build
* then execute `npm run serverless ` to start the serverless server



# Production
* execute `npm run build:dev` to start the development build
* open a command line in the dist folder
* execute `sls deploy`
