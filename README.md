Fis前端资源共享平台 -- Lights
=====================

Fis前端资源共享平台是一个类似于[bower](http://bower.io/)、[components](http://component.github.io/)的前端资源共享平台。提供便捷、易用的资源安装、发布、搜索，管理工具。


## 使用文档

详细的使用文档参考[这里](http://lightjs.duapp.com/repos/doc)

资源平台的官网 ： http://lightjs.duapp.com/repos/components

## 设计说明

平台分为[命令行工具](https://github.com/wangcheng714/fis-repo-client)和[资源网站](https://github.com/wangcheng714/fis-cloud-app-fisrepo)两部分。

### FAQ

#### 已有Bower为啥还要开发Lights

* bower里面的资源主要是js、css、等纯前端资源，Lights可以包括模板(smarty等)在内的任意的组件或者资源
* lights支持搭建私有平台，方便某些大产品线或者公司大家自己的内部的资源聚合平台，搭建步骤参考[这里](https://github.com/lily-zhangying/lights/wiki/newRepos)
* 为了方便资源的共享Lights还提供了脚手架功能，可以在安装时替换一些文本等


