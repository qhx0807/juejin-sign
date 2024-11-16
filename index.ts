import { chromium, devices, Page } from "playwright";
import {
  emailReport,
  loadJsonFile,
  responseHandler,
  waitForResponseHelper,
} from "./utils";
const { COOKIE } = require('./ENV.js')
const pushMessage = require('./utils/pushMessage.js')

const getMessage = () => {
  return `
Hello ${message.get('userName')}
${message.get('checkedIn')}
当前矿石数 ${message.get('sumPoint')}
连续签到天数 ${message.get('contCount')}
累计签到天数 ${message.get('sumCount')}
当前幸运值 ${message.get('luckyValue')}
免费抽奖次数 ${message.get('freeCount')}
${message.get('freeDrawed')}
`.trim()
}

const message: Map<string, string> = new Map();
function addMessage(key: string, value: string) {
  message.set(key, value);
  console.log(key + " => " + value);
}

async function loginCheck(page: Page) {
  await page.goto("https://juejin.cn/");
  // # 使用 JavaScript 设置 Cookie
  await page.evaluate(`document.cookie = "${COOKIE}";`)
  await page.goto("https://juejin.cn/");
  if (
    await page.locator("css=button.login-button").isVisible()
  ) {
    console.log("未登录，请切换为有头模式手动登录，登录完成后重启本程序");
    await page.evaluate(() => {
      document
        .querySelector("main.container.main-container.with-view-nav")
        ?.setHTMLUnsafe(
          "<div style='text-align: center; font-size: 32px;'>请手动登录掘金，登录完成后重启本程序</div>"
        );
    });
    return false;
  }
  return true;
}

async function signin(page: Page) {
  await page.goto("about:blank"); // 避免之前的页面请求的内容影响
  const getUserInfoPro = waitForResponseHelper(
    page,
    "https://api.juejin.cn/user_api/v1/user/get_info_pack"
  );
  const todayStatusPro = waitForResponseHelper(
    page,
    "https://api.juejin.cn/growth_api/v2/get_today_status"
  );
  const curPointPro = waitForResponseHelper(
    page,
    "https://api.juejin.cn/growth_api/v1/get_cur_point"
  );
  const getCountPro = waitForResponseHelper(
    page,
    "https://api.juejin.cn/growth_api/v1/get_counts"
  );
  await page.goto("https://juejin.cn/user/center/signin?from=main_page");

  const [getUserInfoRes, todayStatusRes, curPointRes, getCountRes] =
    await Promise.all([
      getUserInfoPro,
      todayStatusPro,
      curPointPro,
      getCountPro,
    ]);

  const userName = await responseHandler(
    getUserInfoRes,
    (data) => data.user_basic.user_name
  );
  addMessage("userName", userName);

  const signinStatus = await responseHandler(
    todayStatusRes,
    (data) => data.check_in_done
  );

  if (signinStatus) {
    addMessage("checkedIn", "今日已签到");
    const curPoint = await responseHandler(curPointRes, (data) => data);
    const [contCount, sumCount] = await responseHandler(getCountRes, (data) => [
      data.cont_count,
      data.sum_count,
    ]);
    addMessage("sumPoint", curPoint);
    addMessage("contCount", contCount);
    addMessage("sumCount", sumCount);
  } else {
    const signinBtn = page.getByRole("button", { name: /立即签到/ });
    if (await signinBtn.isVisible()) {
      const checkInPro = waitForResponseHelper(
        page,
        "https://api.juejin.cn/growth_api/v1/check_in"
      );
      const getCountPro = waitForResponseHelper(
        page,
        "https://api.juejin.cn/growth_api/v1/get_counts"
      );

      await signinBtn.click();

      const [checkInRes, getCountRes] = await Promise.all([
        checkInPro,
        getCountPro,
      ]);

      const [incrPoint, sumPoint] = await responseHandler(
        checkInRes,
        (data) => [data.incr_point, data.sum_point]
      );
      const [contCount, sumCount] = await responseHandler(
        getCountRes,
        (data) => [data.cont_count, data.sum_count]
      );

      addMessage("checkedIn", `签到成功 +${incrPoint}矿石`);
      addMessage("sumPoint", sumPoint);
      addMessage("contCount", contCount);
      addMessage("sumCount", sumCount);
    } else {
      throw "找不到签到按钮";
    }
  }
}

async function lottery(page: Page) {
  await page.goto("about:blank"); // 避免之前的页面请求的内容影响
  const getLotteryConfigPro = waitForResponseHelper(
    page,
    "https://api.juejin.cn/growth_api/v1/lottery_config/get"
  );
  const lockyPro = waitForResponseHelper(
    page,
    "https://api.juejin.cn/growth_api/v1/lottery_lucky/my_lucky"
  );

  await page.goto(
    "https://juejin.cn/user/center/lottery?from=lucky_lottery_menu_bar"
  );
  const [getLotteryConfigRes, lockyRes] = await Promise.all([
    getLotteryConfigPro,
    lockyPro,
  ]);

  const freeCount = await responseHandler(
    getLotteryConfigRes,
    (data) => data.free_count
  );
  const luckyValue = await responseHandler(
    lockyRes,
    (data) => data.total_value
  );
  addMessage('freeCount', freeCount)

  if (freeCount == 0) {
    addMessage("freeDrawed", "今日已免费抽奖");
    addMessage("luckyValue", luckyValue);
  } else {
    const lotteryBtn = page.locator("css=div.text.text-free");
    if (await lotteryBtn.isVisible()) {
      const lotteryPro = waitForResponseHelper(
        page,
        "https://api.juejin.cn/growth_api/v1/lottery/draw"
      );
      await lotteryBtn.click();
      const lotteryRes = await lotteryPro;

      const [drawLuckyValue, totalLuckyValue, lotteryName] =
        await responseHandler(lotteryRes, (data) => [
          data.draw_lucky_value,
          data.total_lucky_value,
          data.lottery_name,
        ]);

      addMessage(
        "freeDrawed",
        `幸运值 +${drawLuckyValue}, 抽中奖品 ${lotteryName}`
      );
      addMessage("luckyValue", totalLuckyValue);
    } else {
      throw "找不到抽奖按钮";
    }
  }
}

async function main() {

  const context = await chromium.launchPersistentContext("./userData", {
    headless: false,
    ...devices["Desktop Edge"],
  });

  const pages = context.pages();
  let page: Page;
  if (pages.length > 0) {
    page = pages[0];
  } else {
    page = await context.newPage();
  }

  if (!(await loginCheck(page))) return;

  try {
    await signin(page);
    await lottery(page);
    pushMessage({
      type: 'info',
      message: getMessage(),
    })
    // addMessage("报告状态", "QQ邮件已发送");
  } catch (error) {
    console.error(error);
    addMessage("错误信息", JSON.stringify(error, null, 2));
    pushMessage({
      type: 'error',
      message: getMessage(),
    })
  }
  await context.close();
}

main();
