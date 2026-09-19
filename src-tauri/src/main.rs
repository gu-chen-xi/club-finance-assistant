// 防止 Windows release 模式弹出控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    club_finance_assistant_lib::run()
}
