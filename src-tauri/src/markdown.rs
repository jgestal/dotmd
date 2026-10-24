use comrak::{Options, markdown_to_html};

pub fn options() -> Options<'static> {
    let mut o = Options::default();
    let e = &mut o.extension;
    e.strikethrough = true;
    e.table = true;
    e.autolink = true;
    e.tasklist = true;
    e.superscript = true;
    e.subscript = false;
    e.footnotes = true;
    e.description_lists = true;
    e.front_matter_delimiter = Some("---".into());
    e.alerts = true;
    e.math_dollars = true;
    e.math_code = true;
    e.shortcodes = true;
    e.highlight = true;
    e.underline = false;
    e.header_id_prefix = Some(String::new());
    o.parse.smart = false;
    o.parse.relaxed_tasklist_matching = true;
    o.render.r#unsafe = true; // raw HTML allowed; the frontend sanitizes with DOMPurify
    o.render.github_pre_lang = false;
    o.render.sourcepos = true; // enables editor <-> preview scroll sync
    o.render.tasklist_classes = true;
    o
}

#[tauri::command]
pub fn render_markdown(text: String) -> String {
    markdown_to_html(&text, &options())
}

#[cfg(test)]
mod tests {
    #[test]
    fn renders_extensions() {
        let md = "---\ntitle: x\n---\n\n# Title\n\n- [ ] task\n\n> [!NOTE]\n> hi\n\nInline $a^2$\n\n$$\nb\n$$\n\n```mermaid\nflowchart LR\n```\n\n==hl==\n";
        let html = super::render_markdown(md.into());
        println!("{html}");
        assert!(html.contains("data-sourcepos=\"5:1"));
        assert!(html.contains("markdown-alert-note"));
        assert!(html.contains("data-math-style"));
        assert!(html.contains("<mark"));
    }
}
