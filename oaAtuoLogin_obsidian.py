"""
Obsidian 集成版本 — 从 Obsidian 数据目录读取配置和日志文件

配置来源：/Users/hang/Downloads/Documents/Obsidian/_data/oaconfig.md
日志来源：/Users/hang/Downloads/Documents/Obsidian/_data/oa工作日志.md

可通过命令行参数覆盖日志文件路径：
    python oaAtuoLogin_obsidian.py /path/to/其他日志.txt
"""

import configparser
import logging
import os
import sys
from time import sleep

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.service import Service

# --- 关键导入：用于解决驱动版本不匹配问题 ---
from webdriver_manager.chrome import ChromeDriverManager


# -------- Obsidian 数据目录路径 --------
OBSIDIAN_DATA_DIR = os.path.expanduser(
    "~/Downloads/Documents/Obsidian/_data"
)
OBSIDIAN_CONFIG_FILE = os.path.join(OBSIDIAN_DATA_DIR, "oaconfig.md")
OBSIDIAN_LOG_FILE = os.path.join(OBSIDIAN_DATA_DIR, "oa工作日志.md")
OBSIDIAN_OALOG_FILE = os.path.join(OBSIDIAN_DATA_DIR, "oalog.md")


def get_base_dir():
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


BASE_DIR = get_base_dir()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(OBSIDIAN_OALOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def _parse_simple_config(filepath):
    """
    解析无节头的 key = value 配置文件（如 oaconfig.md），
    返回一个 dict 供后续使用。
    """
    config = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or line.startswith(';'):
                continue
            if '=' in line:
                key, _, val = line.partition('=')
                config[key.strip()] = val.strip()
    return config


class OALogin:
    def __init__(self, log_file_path, config_path=None):
        self.driver = None
        self.config = self._load_config(config_path)
        self.log_file_path = log_file_path

    def _load_config(self, config_path=None):
        if config_path is None:
            config_path = OBSIDIAN_CONFIG_FILE

        if not os.path.exists(config_path):
            print(f"\n错误：配置文件不存在 -> {config_path}")
            print("请在 Obsidian _data 目录下创建 oaconfig.md，内容格式如下：")
            print("""username = 你的账号
password = 你的密码
url = http://oa.yli.so/home
log_url = http://oa.yli.so/model/ecmenu.oa.jhrz.gzrz.qt
""")
            sys.exit(1)

        # oaconfig.md 是纯 key=value 格式（无 [LOGIN] 节头），
        # 转为 dict 并以 LOGIN 为 key 包装成 ConfigParser 兼容的嵌套访问
        raw = _parse_simple_config(config_path)
        logger.info(f"已加载配置文件: {config_path}")

        # 包装成 self.config['LOGIN']['xxx'] 访问形式
        class ConfigWrapper:
            def __init__(self, data):
                self._data = data
            def __getitem__(self, key):
                return self._data

        return ConfigWrapper(raw)

    def _init_driver(self):
        options = webdriver.ChromeOptions()
        options.add_experimental_option('excludeSwitches', ['enable-automation'])
        prefs = {
            'credentials_enable_service': False,
            'profile.password_manager_enabled': False
        }
        options.add_experimental_option('prefs', prefs)
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--start-maximized')

        try:
            logger.info("正在检查并获取匹配的 ChromeDriver...")
            try:
                driver_path = ChromeDriverManager().install()
            except Exception:
                logger.warning("ChromeDriverManager 获取失败，尝试使用本地缓存...")
                import glob as _glob
                cached = _glob.glob(os.path.expanduser(
                    "~/.wdm/drivers/chromedriver/mac64/*/chromedriver-mac-arm64/chromedriver"
                ))
                if cached:
                    driver_path = sorted(cached)[-1]
                    logger.info(f"使用缓存驱动: {driver_path}")
                else:
                    raise
            self.driver = webdriver.Chrome(service=Service(driver_path), options=options)
            logger.info("浏览器初始化成功")
            return True
        except Exception as e:
            logger.error(f"浏览器初始化失败: {str(e)}")
            return False

    def _wait_for_page_ready(self, timeout=15):
        try:
            WebDriverWait(self.driver, timeout).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
            return True
        except TimeoutException:
            logger.warning("页面加载超时")
            return False

    def _handle_iframe(self):
        try:
            iframe = WebDriverWait(self.driver, 5).until(
                EC.presence_of_element_located((By.TAG_NAME, 'iframe'))
            )
            self.driver.switch_to.frame(iframe)
            logger.info("已切换到 iframe")
            return True
        except TimeoutException:
            logger.info("未检测到 iframe")
            return False

    def login(self):
        if not self._init_driver():
            return False

        try:
            login_url = self.config['LOGIN']['url']
            self.driver.get(login_url)
            self._wait_for_page_ready()

            username = self.config['LOGIN']['username']
            password = self.config['LOGIN']['password']

            account_input = WebDriverWait(self.driver, 15).until(
                EC.element_to_be_clickable((By.ID, 'form_item_account'))
            )
            sleep(0.5)
            account_input.click()
            account_input.clear()
            account_input.send_keys(username)

            pwd_input = self.driver.find_element(By.ID, 'form_item_password')
            pwd_input.click()
            pwd_input.clear()
            pwd_input.send_keys(password)

            login_btn = WebDriverWait(self.driver, 30).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[type="button"]'))
            )
            sleep(0.5)
            login_btn.click()
            logger.info("登录按钮已点击")

            for _ in range(30):
                if "login" not in self.driver.current_url.lower():
                    logger.info("登录成功")
                    return True
                sleep(1)
            logger.error("登录超时")
            return False

        except Exception as e:
            logger.error(f"登录异常: {str(e)}")
            return False

    def navigate_to_log_page(self):
        try:
            log_url = self.config['LOGIN']['log_url']
            self.driver.get(log_url)
            self._wait_for_page_ready()
            logger.info("已进入日志页面")
            return True
        except Exception as e:
            logger.error(f"跳转日志页面失败: {str(e)}")
            return False

    def click_add_button(self):
        try:
            while True:
                try:
                    btn = WebDriverWait(self.driver, 5).until(
                        EC.element_to_be_clickable((By.XPATH, '//button[.//span[text()="新增"]]'))
                    )
                    btn.click()
                    logger.info("已点击【新增】")
                    return True
                except Exception as e:
                    logger.warning(f"新增按钮点击失败，重试: {e}")
                    sleep(1)
        except Exception as e:
            logger.error(f"新增按钮异常: {e}")
            return False

    def process_log_entries(self):
        try:
            if not os.path.exists(self.log_file_path):
                logger.error("日志文件不存在")
                return False

            with open(self.log_file_path, 'r', encoding='utf-8') as f:
                lines = f.read().split('/')

            row_index = 0
            row_index2 = 5

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                parts = line.split('\n')
                if len(parts) < 2:
                    logger.warning(f"格式错误，跳过: {line[:30]}")
                    continue

                dw = parts[0].strip()
                content = '\n'.join(parts[1:]).replace('\r', '').replace('\t', '')
                logger.info(f"正在处理第 {row_index + 1} 条: {dw}")

                try:
                    add_btn = WebDriverWait(self.driver, 5).until(
                        EC.element_to_be_clickable((By.XPATH, '//button[.//span[text()="添加"]]'))
                    )
                    add_btn.click()
                except:
                    try:
                        self.driver.execute_script("arguments[0].click();", add_btn)
                    except:
                        logger.error("添加按钮点击失败")
                        continue
                sleep(1)

                try:
                    ta = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located(
                            (By.CSS_SELECTOR, f'textarea[placeholder="请输入"][rowindex="{row_index}"]')
                        )
                    )
                    ta.send_keys(content)
                except Exception as e:
                    logger.error(f"内容输入失败: {e}")

                try:
                    selector = WebDriverWait(self.driver, 5).until(
                        EC.element_to_be_clickable(
                            (By.XPATH, f'//input[@id="rc_select_{row_index2}"]/..')
                        )
                    )
                    selector.click()
                    sleep(1)
                except Exception as e:
                    logger.error(f"打开客商失败: {e}")
                    continue

                try:
                    inputs = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_all_elements_located((By.ID, 'form_item_keyword'))
                    )
                    if row_index < len(inputs):
                        inputs[row_index].send_keys(dw)
                        sleep(2)
                except Exception as e:
                    logger.error(f"输入单位失败: {e}")

                try:
                    btns = WebDriverWait(self.driver, 15).until(
                        EC.presence_of_all_elements_located(
                            (By.XPATH, '//button[.//span[text()="查 询"]]')
                        )
                    )
                    idx = row_index + 1
                    if idx < len(btns):
                        btns[idx].click()
                        sleep(2)
                except Exception as e:
                    logger.error(f"查询失败: {e}")

                try:
                    radios = WebDriverWait(self.driver, 15).until(
                        EC.presence_of_all_elements_located(
                            (By.CSS_SELECTOR, 'input.ant-radio-input')
                        )
                    )
                    if radios:
                        radios[-1].click()
                        sleep(1)
                except Exception as e:
                    logger.error(f"选择单位失败: {e}")

                try:
                    submits = WebDriverWait(self.driver, 15).until(
                        EC.presence_of_all_elements_located(
                            (By.XPATH, '//button[.//span[text()="确 定"]]')
                        )
                    )
                    idx = row_index + 1
                    if idx < len(submits):
                        submits[idx].click()
                        sleep(2)
                except Exception as e:
                    logger.error(f"确定失败: {e}")

                row_index += 1
                row_index2 += 1

            logger.info("所有日志处理完成")
            return True

        except Exception as e:
            logger.error(f"处理日志异常: {str(e)}")
            return False

    def run(self):
        try:
            if not self.login():
                return False
            if not self.navigate_to_log_page():
                return False
            if not self.click_add_button():
                return False
            if not self.process_log_entries():
                return False
            logger.info("全部执行完成")
            return True
        except Exception as e:
            logger.error(f"运行异常: {str(e)}")
            return False
        finally:
            if self.driver:
                print("\n填写完成，请手动关闭浏览器窗口以退出程序...")
                while True:
                    try:
                        self.driver.title
                        sleep(2)
                    except:
                        print("\n浏览器已关闭，正在清理进程...")
                        break
            try:
                import subprocess
                subprocess.run(["pkill", "-f", "chromedriver"], capture_output=True)
            except:
                pass
            import gc
            gc.collect()


def main():
    # 默认日志文件：Obsidian _data 下的 oa工作日志.md
    default_path = OBSIDIAN_LOG_FILE

    if len(sys.argv) > 1:
        filepath = sys.argv[1]
        print(f"使用命令行指定文件: {filepath}")
    else:
        filepath = default_path
        print(f"使用 Obsidian 日志文件: {filepath}")

    if not os.path.exists(filepath):
        print(f"\n错误：文件不存在 -> {filepath}")
        print("请确保 Obsidian _data 目录下存在 oa工作日志.md，")
        print("或通过命令行参数指定路径：")
        print(f"    python {os.path.basename(__file__)} /path/to/日志.txt")
        sys.exit(1)

    if not os.path.exists(OBSIDIAN_CONFIG_FILE):
        print(f"\n错误：配置文件不存在 -> {OBSIDIAN_CONFIG_FILE}")
        print("请确保 Obsidian _data 目录下存在 oaconfig.md，内容格式如下：")
        print("""username = 你的账号
password = 你的密码
url = http://oa.yli.so/home
log_url = http://oa.yli.so/model/ecmenu.oa.jhrz.gzrz.qt
""")
        sys.exit(1)

    bot = OALogin(filepath, config_path=OBSIDIAN_CONFIG_FILE)
    ok = bot.run()
    if ok:
        print("✅ 全部执行成功！")
        sys.exit(0)
    else:
        print("❌ 执行出错，请查看日志")
        sys.exit(1)


if __name__ == "__main__":
    main()
