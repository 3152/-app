# 
#红旗智联app每日签到


1.在青龙面板添加环境变量：
  hqPhone: 手机号
  hqPwd: 密码
2.多账号用@分隔，例如：
  hqPhone: 13800138000@13900139000
  hqPwd: password1@password2
3.定时任务设置为：
  15 11 * * *（每天11:15执行）
4.主要功能：
  自动登录获取token
  每日签到
  每周分享
  评论文章
  发布问答
  回答问答
  发布动态
  查询积分
5.调试模式：
  将debug改为1可以查看详细日志
  建议先用单账号测试，确认正常后再添加多账号。
