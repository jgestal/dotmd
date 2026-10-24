//! Renders Markdown from stdin to HTML on stdout (used by the UI test harness).
use std::io::Read;

fn main() {
    let mut s = String::new();
    std::io::stdin().read_to_string(&mut s).unwrap();
    print!("{}", dotmd_lib::markdown::render_markdown(s));
}
