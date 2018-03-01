# protobufjs-webpack-plugin

转译protobuf文件为js文件

### Install

``` bash
npm install --save-dev protobufjs-webpack-plugin
```

### Usage

Add it to your `webpack.config.js`
``` js
var ProtobufPlugin  = require('protobufjs-webpack-plugin');

module.exports = {
    plugins: [
        new ProtobufPlugin({
            input: path.join('proto', '*.proto'),
            output: path.join('dist', 'proto')
        })
    ]
};
```

### Config
``` js
{
    input: '',      // 输入文件匹配
    output: '',     // 输出路径， 如果是文件夹，单文件输出则以 basic.proto.js命名，多文件以文件名拼接
    outputType: 1,  // 输入方式，默认多文件形式， 如果设置为 0，则所有合并为单文件
    target: 'static-module',    // 类型 json|json-module|static\static-module
    format: 'es6',  // 输出格式： es6|commonjs|amd|closure
    create: true,   // 是否需要 create方法
    encode: true,   // 是否需要 encode 方法
    decode: true,   // 是否需要 decode 方法
    verify: true,   // 是否需要 verify 方法
    delimited: true,    // 是否需要 delimited 方法
    beautify: true,     // 是否需要美化代码
    comments: true,     // 是否需要代码注释文档
    convert: true   // 是否需要 from/toObject
}
```

### Example
`demo.proto`
``` protobuf
package base;
syntax = "proto3";

message base {
    string base = 1;
}
```
compile to `base.js`

In your js
``` js
var axios = require('axios');
var base = require('base.js');

// decode data
function fetchDecode(proto, data) {
    return proto.decode(new Uint8Array(data));
}

// encode data
function fetchEncode(proto, data) {
    return proto.encode(proto.create(data)).finish();
}

let buffer = fetchEncode(base.base, {'base': '1'});

axios.post('http://localhost:8080/protobuf', buffer, {
    responseType: 'arraybuffer',
    headers: {
        'Content-type': 'application/octet-stream'
    }
})
    .then(res => {
        let data = fetchDecode(base.base, res);
        console.log(data);
    });

```