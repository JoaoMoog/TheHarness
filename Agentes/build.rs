fn main() {
    println!("cargo:rerun-if-changed=ui/dist");
    println!("cargo:rerun-if-changed=assets/app.rc");
    println!("cargo:rerun-if-changed=assets/speedcode.ico");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let out = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("appicon.o");
        let tool = std::env::var("SPEEDCODE_WINDRES")
            .or_else(|_| std::env::var("AGENTDESK_WINDRES"))
            .unwrap_or_else(|_| "windres".into());
        let result = std::process::Command::new(tool)
            .args(["-i", "assets/app.rc", "-O", "coff", "-o"])
            .arg(&out)
            .status()
            .expect("windres must be available for application icon");
        assert!(result.success(), "resource compilation failed");
        println!("cargo:rustc-link-arg={}", out.display());
    }
}
