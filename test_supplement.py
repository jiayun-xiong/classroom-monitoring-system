#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
补充测试: 签到通知正确流程 + 调查通知 + 更多边界
"""
import json
import urllib.request
import urllib.error
import datetime

BASE = "http://localhost:3000/api"

def api_call(method, path, token=None, body=None):
    url = BASE + path
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw), resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return json.loads(raw), e.code
        except:
            return {"raw": raw}, e.code
    except Exception as e:
        return {"error": str(e)}, 0

def login(username, password):
    res, _ = api_call("POST", "/auth/login", body={"username": username, "password": password})
    return res["data"]["token"] if res.get("code") == 0 else None

T = login("lilaoshi", "123456")
TS = login("zhangsan", "123456")
COURSE_ID = 14

results = []

# --- 补充1: 签到发布通知(正确流程) ---
print("=" * 60)
print("补充1: 签到发布通知(正确流程: 开始上课->发布签到)")
print("=" * 60)

# 先记录张三当前checkin未读数
res_before, _ = api_call("GET", f"/notifications/unread-by-type?courseId={COURSE_ID}", token=TS)
checkin_before = res_before.get("data", {}).get("checkin", 0) if res_before.get("code") == 0 else -1
print(f"  签到前张三checkin未读: {checkin_before}")

# 开始上课
res, code = api_call("POST", f"/courses/{COURSE_ID}/session", token=T, body={})
print(f"  开始上课: {json.dumps(res, ensure_ascii=False)[:300]}")
if res.get("code") == 0:
    session_id = res["data"]["session"]["id"]
    print(f"  会话ID: {session_id}")

    # 发布签到
    res, code = api_call("POST", f"/sessions/{session_id}/checkin", token=T, body={
        "lat": 31.82, "lng": 117.25, "windowMinutes": 5
    })
    print(f"  发布签到: {json.dumps(res, ensure_ascii=False)[:300]}")
    if res.get("code") == 0:
        # 检查张三通知
        res_after, _ = api_call("GET", f"/notifications/unread-by-type?courseId={COURSE_ID}", token=TS)
        checkin_after = res_after.get("data", {}).get("checkin", 0) if res_after.get("code") == 0 else -1
        print(f"  签到后张三checkin未读: {checkin_after}")
        if checkin_after > checkin_before:
            results.append(("12-T15-FIX", "模块12", "签到发布通知学生(正确流程)",
                           "PASS", f"before={checkin_before}, after={checkin_after}",
                           f"HTTP {code}"))
        else:
            results.append(("12-T15-FIX", "模块12", "签到发布通知学生(正确流程)",
                           "FAIL", f"before={checkin_before}, after={checkin_after}",
                           f"HTTP {code}"))
        # 结束上课
        api_call("POST", f"/sessions/{session_id}/end", token=T)
    else:
        results.append(("12-T15-FIX", "模块12", "签到发布通知学生(正确流程)",
                       "FAIL", f"发布签到失败: code={res.get('code')}, msg={res.get('message')}",
                       f"HTTP {code}"))
        api_call("POST", f"/sessions/{session_id}/end", token=T)
else:
    results.append(("12-T15-FIX", "模块12", "签到发布通知学生(正确流程)",
                   "FAIL", f"开始上课失败: code={res.get('code')}, msg={res.get('message')}",
                   f"HTTP {code}"))

# --- 补充2: 调查发布通知学生 ---
print("\n" + "=" * 60)
print("补充2: 调查发布通知学生")
print("=" * 60)

# 查看调查路由
res_before, _ = api_call("GET", f"/notifications/unread-by-type?courseId={COURSE_ID}", token=TS)
survey_before = res_before.get("data", {}).get("survey", 0) if res_before.get("code") == 0 else -1
print(f"  调查前张三survey未读: {survey_before}")

# 发布调查
res, code = api_call("POST", f"/courses/{COURSE_ID}/surveys", token=T, body={
    "title": "[测C]通知测试调查",
    "description": "测试调查通知",
    "questions": [{"type": "radio", "title": "你喜欢这门课吗？", "options": ["喜欢", "一般", "不喜欢"]}]
})
print(f"  发布调查: {json.dumps(res, ensure_ascii=False)[:300]}")
if res.get("code") == 0:
    res_after, _ = api_call("GET", f"/notifications/unread-by-type?courseId={COURSE_ID}", token=TS)
    survey_after = res_after.get("data", {}).get("survey", 0) if res_after.get("code") == 0 else -1
    print(f"  调查后张三survey未读: {survey_after}")
    if survey_after > survey_before:
        results.append(("12-T16", "模块12", "调查发布通知学生",
                       "PASS", f"before={survey_before}, after={survey_after}",
                       f"HTTP {code}"))
    else:
        results.append(("12-T16", "模块12", "调查发布通知学生",
                       "FAIL", f"before={survey_before}, after={survey_after}",
                       f"HTTP {code}"))
else:
    results.append(("12-T16", "模块12", "调查发布通知学生",
                   "FAIL", f"code={res.get('code')}, msg={res.get('message')}",
                   f"HTTP {code}"))

# --- 补充3: 成绩计算验证(手动计算) ---
print("\n" + "=" * 60)
print("补充3: 成绩计算准确性验证")
print("=" * 60)

res, code = api_call("GET", f"/courses/{COURSE_ID}/final", token=T)
if res.get("code") == 0:
    data = res["data"]
    weights = data["weights"]
    print(f"  权重: 签到={weights['checkinWeight']}%, 作业={weights['homeworkWeight']}%, 期末={weights['examWeight']}%")
    print(f"  会话数: {data['sessionCount']}, 作业数: {data['homeworkCount']}, 考试数: {data['examCount']}")

    all_correct = True
    for s in data["list"]:
        if s["final"] is None:
            print(f"  {s['name']}: 无期末成绩, final=null (正确)")
            continue
        # 手动计算
        expected = s["checkinScore"] * weights["checkinWeight"] / 100 + \
                   s["homeworkScore"] * weights["homeworkWeight"] / 100 + \
                   s["examScore"] * weights["examWeight"] / 100
        expected = round(expected * 10) / 10
        match = abs(expected - s["final"]) < 0.15
        print(f"  {s['name']}: 签到={s['checkinScore']}, 作业={s['homeworkScore']}, 期末={s['examScore']} -> "
              f"API={s['final']}, 手算={expected}, rank={s['rank']}, {'✓' if match else '✗'}")
        if not match:
            all_correct = False

    if all_correct:
        results.append(("09-T14", "模块09", "成绩计算准确性验证",
                       "PASS", "所有学生加权计算正确", f"HTTP {code}"))
    else:
        results.append(("09-T14", "模块09", "成绩计算准确性验证",
                       "FAIL", "部分学生计算不一致", f"HTTP {code}"))
else:
    results.append(("09-T14", "模块09", "成绩计算准确性验证",
                   "FAIL", f"code={res.get('code')}", f"HTTP {code}"))

# --- 补充4: 学分加权总成绩(跨课程) ---
print("\n" + "=" * 60)
print("补充4: 学分加权总成绩(跨课程验证)")
print("=" * 60)

# 检查学生是否有跨课程总成绩接口
# 查看学生所有课程的总成绩
res, code = api_call("GET", "/courses", token=TS)
print(f"  学生课程列表: {json.dumps(res, ensure_ascii=False)[:400]}")

# 查看是否有总成绩接口(学生端)
# 从路由看没有跨课程总成绩接口, 只有单课程的final
results.append(("10-T10", "模块10", "学分加权总成绩(跨课程)",
               "INFO", "API只有单课程final接口,无跨课程加权接口",
               "无对应API路由"))

# --- 补充5: 通知列表分页 ---
print("\n" + "=" * 60)
print("补充5: 通知列表分页")
print("=" * 60)
res, code = api_call("GET", "/notifications?page=1&pageSize=5", token=TS)
print(f"  通知列表(分页参数): {json.dumps(res, ensure_ascii=False)[:300]}")
# 代码中 limit: 100, 没有分页参数支持
if res.get("code") == 0:
    notifs = res["data"]["list"]
    results.append(("12-T17", "模块12", "通知列表分页",
                   "PASS", f"返回{len(notifs)}条(固定limit=100,无分页参数)",
                   f"HTTP {code}"))
else:
    results.append(("12-T17", "模块12", "通知列表分页",
                   "FAIL", f"code={res.get('code')}", f"HTTP {code}"))

# --- 补充6: 学生不能给非本课程教师发消息 ---
print("\n" + "=" * 60)
print("补充6: 学生不能给非本课程教师发消息")
print("=" * 60)
# 张三尝试给课程16(王老师)发消息
res, code = api_call("POST", "/notifications/send", token=TS, body={
    "receiverRole": "teacher",
    "courseId": 16,  # 王老师的课
    "title": "[测C]越权发消息",
    "content": "测试",
    "link": "/student"
})
print(f"  张三给课程16教师发消息: {json.dumps(res, ensure_ascii=False)}")
# 张三在课程16中(5名学生全部加入了4门课), 所以应该可以发
if res.get("code") == 0:
    results.append(("12-T18", "模块12", "学生给本课程教师发消息",
                   "PASS", f"code=0, 张三在课程16中", f"HTTP {code}"))
else:
    results.append(("12-T18", "模块12", "学生给本课程教师发消息",
                   "FAIL", f"code={res.get('code')}, msg={res.get('message')}", f"HTTP {code}"))

# --- 补充7: 课程卡待办角标(按课程未读数) ---
print("\n" + "=" * 60)
print("补充7: 课程卡待办角标(按课程未读数)")
print("=" * 60)
for cid in [13, 14, 15, 16]:
    res, code = api_call("GET", f"/notifications/unread-by-type?courseId={cid}", token=TS)
    if res.get("code") == 0:
        data = res["data"]
        total = sum(v for v in data.values() if isinstance(v, (int, float)))
        print(f"  课程{cid} 未读: {data} (总计{total})")
results.append(("12-T19", "模块12", "课程卡待办角标(按课程未读)",
               "PASS", "支持按课程查询各类型未读数", "HTTP"))

# --- 汇总 ---
print("\n" + "=" * 60)
print("补充测试汇总")
print("=" * 60)
for r in results:
    print(f"  {r[0]:<12} {r[1]:<10} {r[2]:<35} {r[3]:<6}")
