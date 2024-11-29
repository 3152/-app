/**
 作者：临渊(修改版)
 日期：2024-1-1
 软件：红旗智联
 功能：账号密码登录版
 
 使用说明：
 1. 环境变量填写
    - hqPhone: 登录手机号，多账号用@分隔
    - hqPwd: 登录密码，多账号用@分隔
    例如：
    hqPhone: 13800138000@13900139000
    hqPwd: password1@password2
 
 2. 定时任务
    推荐每天执行一次：15 11 * * *
 
 [task_local]
 #红旗智联
 15 11 * * * hqzl-login.js, tag=红旗智联, enabled=true
 */

const $ = new Env('红旗智联');
const notify = $.isNode() ? require('./sendNotify') : '';
const {log} = console;
const Notify = 1; //0为关闭通知，1为打开通知,默认为1
const debug = 0; //0为关闭调试，1为打开调试,默认为0

// 版本信息
let scriptVersion = "2.0.0";
let scriptVersionLatest = '';

// 账号信息
let hqPhone = ($.isNode() ? process.env.hqPhone : $.getdata("hqPhone")) || "";
let hqPhoneArr = [];
let hqPwd = ($.isNode() ? process.env.hqPwd : $.getdata("hqPwd")) || "";
let hqPwdArr = [];

// 全局变量
let data = '';
let msg = '';
let baseUrl = 'https://hqapp.faw.cn/fawcshop';
let token = ''; // 存储登录后的token
let aid = ''; // 存储登录后的aid
let contentIdArr = [];
let getArticlesBack = 0;
let getQuestionsBack = 0;
let questionId = 0;
let questionContent = '';
let questionIdArr = [];
let getDynamicBack = 0;
let dynamicContent = '';

// 主函数
!(async () => {
    if (!(await Envs())) {
        return;
    }

    log(`\n=============================================    \n脚本执行 - 北京时间(UTC+8)：${new Date(
        new Date().getTime() + new Date().getTimezoneOffset() * 60 * 1000 +
        8 * 60 * 60 * 1000).toLocaleString()} \n=============================================\n`);

    await poem();
    await getVersion();
    log(`\n============ 当前版本：${scriptVersion}，最新版本：${scriptVersionLatest} ============`)
    log(`\n=================== 共找到 ${hqPhoneArr.length} 个账号 ===================`)

    for (let index = 0; index < hqPhoneArr.length; index++) {
        let num = index + 1;
        log(`\n========= 开始【第 ${num} 个账号】=========\n`)

        // 获取当前账号的手机号和密码
        let phone = hqPhoneArr[index];
        let password = hqPwdArr[index];

        msg += `\n\n第${num}个账号运行结果：`

        // 1. 登录获取token
        let loginRes = await login(phone, password);
        if (!loginRes) {
            continue; // 登录失败，跳过当前账号
        }

        // 2. 执行任务
        await runTasks();
    }
    
    await SendMsg(msg);
})()
    .catch((e) => log(e))
    .finally(() => $.done())

/**
 * 账号登录
 * @param {string} phone - 手机号
 * @param {string} password - 密码
 * @returns {Promise<boolean>} 登录是否成功
 */
function login(phone, password) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/auth/login`,
            headers: {
                "Content-Type": "application/json",
                "Host": "hqapp.faw.cn",
                "Connection": "Keep-Alive",
                "Accept-Encoding": "gzip",
                "User-Agent": "okhttp/3.11.0"
            },
            body: JSON.stringify({
                "phone": phone,
                "password": password,
                "loginType": "PASSWORD"
            })
        }

        if (debug) {
            log(`\n【debug】=============== 这是 登录 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.post(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 登录 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    token = result.data.token;
                    aid = result.data.userId;
                    log(`登录成功！`)
                    msg += `\n登录成功！`;
                    resolve(true);
                } else {
                    log(`登录失败，原因是：${result.msg}`)
                    msg += `\n登录失败，原因是：${result.msg}`;
                    resolve(false);
                }
            } catch (e) {
                log(e)
                resolve(false);
            }
        })
    })
}

/**
 * 这是第二段
 * 执行所有任务
 */
async function runTasks() {
    // 设置通用请求头
    let headers = {
        "Authorization": token,
        "aid": aid,
        "platform": "2",
        "version": "3.18.0",
        "Content-Type": "application/json",
        "Host": "hqapp.faw.cn",
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip",
        "User-Agent": "okhttp/3.11.0"
    };

    log('【开始签到】');
    await doSignin(headers);
    await $.wait(randomInt(3000,6000));

    log('【开始分享】');
    await doShare(headers);
    await $.wait(randomInt(3000,6000));

    // 评论相关
    await getArticles(headers);
    await $.wait(randomInt(3000,6000));

    if (getArticlesBack) {
        log(`【开始评论】`);
        for (let i in contentIdArr) {
            await addComment(headers, i);
            await $.wait(randomInt(3000,6000));
        }
    }
    contentIdArr.length = 0;

    // 问答相关
    await getQuestions(headers);
    await $.wait(randomInt(3000,6000));
    
    if (getQuestionsBack) {
        log('【开始发布问答】');
        await addQuestion(headers);
        await $.wait(randomInt(3000,6000));
    }

    await getLikesQuestions(headers);
    await $.wait(randomInt(3000,6000));
    
    if (getQuestionsBack) {
        log(`【开始回答】`);
        for (let i in questionIdArr) {
            await getLikesQuestionsComment(headers, i);
            await $.wait(randomInt(5000,10000));
            if (getQuestionsBack) {
                await answerQuestion(headers);
                await $.wait(randomInt(5000,10000));
            }
        }
    }
    questionIdArr.length = 0;

    await getDynamic(headers);
    await $.wait(randomInt(3000,6000));
    
    if (getDynamicBack) {
        log('【开始发布动态】');
        await addDynamic(headers);
        await $.wait(randomInt(3000,6000));
    }

    log('【开始获取信息】');
    await getInfo(headers);
    await $.wait(randomInt(3000,6000));
}

/**
 * 签到
 */
function doSignin(headers) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/collect-public/v1/score/addScore`,
            headers: headers,
            body: `{"scoreType":"2"}`,
        }

        if (debug) {
            log(`\n【debug】=============== 这是 签到 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.post(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 签到 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    log(`签到成功，获得：${result.data.score}积分`)
                    msg += `\n签到成功，获得：${result.data.score}积分`;
                } else {
                    log(`签到失败，原因是：${result.msg}`)
                    msg += `\n签到失败，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 分享
 */
function doShare(headers) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/collect-public/v1/score/addScore`,
            headers: headers,
            body: `{"scoreType":"4"}`,
        }

        if (debug) {
            log(`\n【debug】=============== 这是 分享 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.post(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 分享 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    if (result.data.score != null) {
                        log(`分享成功，获得：${result.data.score}积分`)
                        msg += `\n分享成功，获得：${result.data.score}积分`;
                    } else {
                        log(`分享成功，但每周上限一次，故未获得积分`)
                        msg += `\n分享成功，但每周上限一次，故未获得积分`;
                    }
                } else {
                    log(`分享失败，原因是：${result.msg}`)
                    msg += `\n分享失败，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 这是第三段
 * 获取文章
 */
function getArticles(headers) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/cms/api/front/content/queryPostList?city=%E9%93%9C%E4%BB%81%E5%B8%82&stats=2&pageNo=1&pageSize=10`,
            headers: headers
        }

        if (debug) {
            log(`\n【debug】=============== 这是 获取文章 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.get(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 获取文章 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    for (let i = 0; i < 2; i++) {
                        contentIdArr.push(result.data[i].contentId)
                    }
                    getArticlesBack = 1;
                } else {
                    getArticlesBack = 0;
                    log(`获取文章失败，不进行评论，原因是：${result.msg}`)
                    msg += `\n获取文章失败，不进行评论，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 评论文章
 */
function addComment(headers, num) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/cms/api/front/hongqi/comment/save`,
            headers: headers,
            body: `{"txt":"说得好","contentId":"${contentIdArr[num]}","parentId":""}`
        }

        if (debug) {
            log(`\n【debug】=============== 这是 评论 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.post(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 评论 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    log(`评论[id=${contentIdArr[num]}]文章成功`)
                    msg += `\n评论[id=${contentIdArr[num]}]文章成功`;
                } else {
                    log(`评论[id=${contentIdArr[num]}]文章失败，原因是：${result.msg}`)
                    msg += `\n评论[id=${contentIdArr[num]}]文章失败，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 获取问答列表
 */
function getQuestions(headers) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/collect-qa/v2/QACenter/getQuestionsListRevision?seriesCode=all&pageNo=1&orderByRule=RULE13&pageSize=10&qaSortId=0`,
            headers: headers
        }

        if (debug) {
            log(`\n【debug】=============== 这是 获取问答 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.get(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 获取问答 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    questionId = result.data[0].qaSortId;
                    questionId++;
                    questionContent = result.data[randomInt(0,9)].content;
                    getQuestionsBack = 1;
                } else {
                    getQuestionsBack = 0;
                    log(`获取问答失败，不进行发布问答，原因是：${result.msg}`)
                    msg += `\n获取问答失败，不进行发布问答，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 发布问答
 */
function addQuestion(headers) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/collect-qa/v2/QACenter/saveQuestionsDetailRevision`,
            headers: headers,
            body: `{"catalogId":${questionId},"seriesCode":"all","userType":0,"content":"${questionContent}"}`
        }

        if (debug) {
            log(`\n【debug】=============== 这是 发布问答 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.post(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 发布问答 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    log(`发布[id=${questionId}]问答成功`)
                    msg += `\n发布[id=${questionId}]问答成功`;
                } else {
                    log(`发布[id=${questionId}]问答失败，原因是：${result.msg}`)
                    msg += `\n发布[id=${questionId}]问答失败，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 这是第四段
 * 获取最热问答
 */
function getLikesQuestions(headers) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/collect-qa/v2/QACenter/getQuestionsListRevision?seriesCode=all&pageNo=1&orderByRule=RULE12&pageSize=150&qaSortId=0`,
            headers: headers
        }

        if (debug) {
            log(`\n【debug】=============== 这是 获取最热问答 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.get(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 获取最热问答 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    let id = randomInt(0,145)
                    for (let i = 0; i < 3; i++) {
                        questionIdArr.push(result.data[id+i].id);
                    }
                    getQuestionsBack = 1;
                } else {
                    getQuestionsBack = 0;
                    log(`获取最热问答失败，不进行回答提问，原因是：${result.msg}`)
                    msg += `\n获取最热问答失败，不进行回答提问，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 获取最热问答评论
 */
function getLikesQuestionsComment(headers, num) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/collect-sns/v1/dynamicTopic/getCommentUnionList?contentId=${questionIdArr[num]}&commentType=8400&commentDetailsId=&pageSize=10&pageNo=1&orderByRule=RULE10`,
            headers: headers
        }

        if (debug) {
            log(`\n【debug】=============== 这是 获取最热问答评论 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.get(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 获取最热问答评论 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    let id = randomInt(0,9)
                    questionId = result.data.result[id].commentInfo.contentId;
                    questionContent = result.data.result[id].commentContext;
                    getQuestionsBack = 1;
                } else {
                    getQuestionsBack = 0;
                    log(`获取最热问答评论失败，不进行回答提问，原因是：${result.msg}`)
                    msg += `\n获取最热问答评论失败，不进行回答提问，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 回答问答
 */
function answerQuestion(headers) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/collect-sns/v1/dynamicTopic/saveCommentDetailsRevision`,
            headers: headers,
            body: `{"commentContext":"${questionContent}","commentType":"8400","contentId":"${questionId}","parentId":"0","fileString":[]}`
        }

        if (debug) {
            log(`\n【debug】=============== 这是 回答问答 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.post(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 回答问答 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    log(`回答[id=${questionId}]问答成功`)
                    msg += `\n回答[id=${questionId}]问答成功`;
                } else {
                    log(`回答[id=${questionId}]问答失败，原因是：${result.msg}`)
                    msg += `\n回答[id=${questionId}]问答失败，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 获取动态
 */
function getDynamic(headers) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/collect-sns/v1/dynamicTopic/getDynamicList?pageNo=1&refreshTime=2023-07-23%2015%3A04%3A55&likeFlag=0&orderByRule=RULE19&pageSize=20`,
            headers: headers
        }

        if (debug) {
            log(`\n【debug】=============== 这是 获取动态 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.get(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 获取动态 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    dynamicContent = result.data[randomInt(0,19)].content;
                    getDynamicBack = 1;
                } else {
                    getDynamicBack = 0;
                    log(`获取动态失败，不进行发布动态，原因是：${result.msg}`)
                    msg += `\n获取动态失败，不进行发布动态，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 这是第五段
 * 发布动态
 */
function addDynamic(headers) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/collect-sns/v1/dynamicTopic/saveDynamicInfoImgUrl`,
            headers: headers,
            body: `{"province":"北京市","city":"北京市","content":"${dynamicContent}"}`
        }

        if (debug) {
            log(`\n【debug】=============== 这是 发布动态 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.post(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 发布动态 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    log(`发布[id=${result.data.result.id}]动态成功`)
                    msg += `\n发布[id=${result.data.result.id}]动态成功`;
                } else {
                    log(`发布动态失败，原因是：${result.msg}`)
                    msg += `\n发布动态失败，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 获取个人信息
 */
function getInfo(headers) {
    return new Promise((resolve) => {
        let url = {
            url: `${baseUrl}/mall/v1/apiCus/getUserInfo`,
            headers: headers,
            body: `{"userId":"${aid}"}`
        }

        if (debug) {
            log(`\n【debug】=============== 这是 获取个人信息 请求 url ===============`);
            log(JSON.stringify(url));
        }

        $.post(url, async (error, response, data) => {
            try {
                if (debug) {
                    log(`\n\n【debug】===============这是 获取个人信息 返回data==============`);
                    log(data)
                }
                let result = JSON.parse(data);
                if (result.code == '000000') {
                    log(`账号[${result.data.nickname}]积分余额为：${result.data.scoreCount}`)
                    msg += `\n账号[${result.data.nickname}]积分余额为：${result.data.scoreCount}`;
                } else {
                    log(`获取个人信息失败，原因是：${result.msg}`)
                    msg += `\n获取个人信息失败，原因是：${result.msg}`;
                }
            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        })
    })
}

/**
 * 变量检查
 */
async function Envs() {
    if (hqPhone) {
        if (hqPhone.indexOf("@") != -1) {
            hqPhone.split("@").forEach((item) => {
                hqPhoneArr.push(item);
            });
        } else if (hqPhone.indexOf("\n") != -1) {
            hqPhone.split("\n").forEach((item) => {
                hqPhoneArr.push(item);
            });
        } else {
            hqPhoneArr.push(hqPhone);
        }
    } else {
        log(`\n 【${$.name}】：未填写变量 hqPhone`)
        return false;
    }

    if (hqPwd) {
        if (hqPwd.indexOf("@") != -1) {
            hqPwd.split("@").forEach((item) => {
                hqPwdArr.push(item);
            });
        } else if (hqPwd.indexOf("\n") != -1) {
            hqPwd.split("\n").forEach((item) => {
                hqPwdArr.push(item);
            });
        } else {
            hqPwdArr.push(hqPwd);
        }
    } else {
        log(`\n 【${$.name}】：未填写变量 hqPwd`)
        return false;
    }

    if (hqPhoneArr.length !== hqPwdArr.length) {
        log(`\n 【${$.name}】：账号密码数量不匹配！`)
        return false;
    }

    return true;
}

/**
 * 获取远程版本
 */
function getVersion(timeout = 3 * 1000) {
    return new Promise((resolve) => {
        let url = {
            url: `https://raw.gh.fakev.cn/LinYuanovo/scripts/main/hqzl.js`,
        }
        $.get(url, async (err, resp, data) => {
            try {
                scriptVersionLatest = data.match(/scriptVersion = "([\d\.]+)"/)[1]
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve()
            }
        }, timeout)
    })
}

/**
 * 获取随机诗词
 */
function poem(timeout = 3 * 1000) {
    return new Promise((resolve) => {
        let url = {
            url: `https://v1.jinrishici.com/all.json`
        }
        $.get(url, async (err, resp, data) => {
            try {
                data = JSON.parse(data)
                log(`${data.content}  \n————《${data.origin}》${data.author}`);
            } catch (e) {
                log(e, resp);
            } finally {
                resolve()
            }
        }, timeout)
    })
}

/**
 * 随机整数生成
 */
function randomInt(min, max) {
    return Math.round(Math.random() * (max - min) + min)
}

// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}isStash(){return"undefined"!=typeof $environment&&$environment["stash-version"]}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),n={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){if(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:i,statusCode:r,headers:o,rawBody:h}=t,a=s.decode(h,this.encoding);e(null,{status:i,statusCode:r,headers:o,rawBody:h,body:a},a)},t=>{const{message:i,response:r}=t;e(i,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){let i=require("iconv-lite");this.initGotEnv(t);const{url:r,...o}=t;this.got[s](r,o).then(t=>{const{statusCode:s,statusCode:r,headers:o,rawBody:h}=t,a=i.decode(h,this.encoding);e(null,{status:s,statusCode:r,headers:o,rawBody:h,body:a},a)},t=>{const{message:s,response:r}=t;e(s,r,r&&i.decode(r.rawBody,this.encoding))})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl,i=t["update-pasteboard"]||t.updatePasteboard;return{"open-url":e,"media-url":s,"update-pasteboard":i}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
