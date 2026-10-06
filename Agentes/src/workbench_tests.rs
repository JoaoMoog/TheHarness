use super::*;
fn init(root: &Path) {
    git_ok(root, &["init", "-b", "main"]).unwrap();
    git_ok(root, &["config", "user.name", "SpeedCode test"]).unwrap();
    git_ok(root, &["config", "user.email", "test@example.invalid"]).unwrap();
    fs::write(root.join("code.txt"), "base\n").unwrap();
    git_ok(root, &["add", "."]).unwrap();
    git_ok(root, &["commit", "-m", "base"]).unwrap();
}
#[test]
fn create_and_publish_local_and_remote_branch() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("work");
    let remote = temp.path().join("remote.git");
    fs::create_dir(&root).unwrap();
    fs::create_dir(&remote).unwrap();
    init(&root);
    git_ok(&remote, &["init", "--bare"]).unwrap();
    git_ok(&root, &["remote", "add", "origin", &friendly(&remote)]).unwrap();
    let b = Backend::fixture(&root);
    let mut p = json!({"root":friendly(&root),"remote":"origin"});
    handle(&b, "git_publish", &p).unwrap();
    p["ref"] = json!("refs/remotes/origin/main");
    p["name"] = json!("feature/cloud-base");
    handle(&b, "git_branch_create", &p).unwrap();
    assert!(git_ok(&root, &["rev-parse", "--abbrev-ref", "@{upstream}"]).is_err());
    handle(&b, "git_publish", &p).unwrap();
    assert!(
        git_ok(
            &remote,
            &["show-ref", "--verify", "refs/heads/feature/cloud-base"]
        )
        .is_ok()
    );
    assert_eq!(
        String::from_utf8_lossy(
            &git_ok(&root, &["rev-parse", "--abbrev-ref", "@{upstream}"]).unwrap()
        )
        .trim(),
        "origin/feature/cloud-base"
    );
    p["ref"] = json!("refs/heads/main");
    p["name"] = json!("local-copy");
    p["switch"] = json!(false);
    handle(&b, "git_branch_create", &p).unwrap();
    p["ref"] = json!("refs/heads/local-copy");
    handle(&b, "git_branch_delete", &p).unwrap();
    p["name"] = json!("--force");
    assert!(handle(&b, "git_branch_create", &p).is_err());
    p["remote"] = json!("https://not-registered.invalid");
    assert!(handle(&b, "git_publish", &p).is_err());
    assert!(git_ok(&remote, &["show-ref", "--verify", "refs/heads/main"]).is_ok());
}
#[test]
fn branches_stash_merge_real_git() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().canonicalize().unwrap();
    init(&root);
    let b = Backend::fixture(&root);
    let mut p = json!({"root":friendly(&root)});
    git_ok(&root, &["branch", "feature"]).unwrap();
    let bs = handle(&b, "git_branches", &p).unwrap();
    assert_eq!(bs.as_array().unwrap().len(), 2);
    p["ref"] = json!("refs/heads/feature");
    handle(&b, "git_switch", &p).unwrap();
    fs::write(root.join("code.txt"), "feature\n").unwrap();
    git_ok(&root, &["commit", "-am", "feature"]).unwrap();
    p["ref"] = json!("refs/heads/main");
    handle(&b, "git_switch", &p).unwrap();
    p["ref"] = json!("refs/remotes/origin/main");
    assert!(handle(&b, "git_branch_delete", &p).is_err());
    p["ref"] = json!("refs/heads/feature");
    assert!(handle(&b, "git_branch_delete", &p).is_err());
    fs::write(root.join("new.txt"), "new content\n").unwrap();
    handle(&b, "git_switch", &p).unwrap();
    assert!(root.join("new.txt").exists());
    p["ref"] = json!("refs/heads/main");
    handle(&b, "git_switch", &p).unwrap();
    p["message"] = json!("save work");
    let stash = handle(&b, "git_stash_create", &p).unwrap();
    assert!(
        !root.join("new.txt").exists(),
        "stash={stash}, status={:?}",
        git_ok(&root, &["status", "--porcelain"])
    );
    let ss = handle(&b, "git_stashes", &p).unwrap();
    p["oid"] = ss[0]["oid"].clone();
    assert!(
        handle(&b, "git_stash_show", &p).unwrap()["output"]
            .as_str()
            .unwrap()
            .contains("new content")
    );
    handle(&b, "git_stash_apply", &p).unwrap();
    assert!(root.join("new.txt").exists());
    assert_eq!(
        handle(&b, "git_stashes", &p)
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        1
    );
    handle(&b, "git_stash_drop", &p).unwrap();
    assert!(handle(&b, "git_stash_drop", &p).is_err());
    git_ok(&root, &["add", "."]).unwrap();
    git_ok(&root, &["commit", "-m", "new"]).unwrap();
    fs::write(root.join("code.txt"), "main\n").unwrap();
    git_ok(&root, &["commit", "-am", "main"]).unwrap();
    assert!(git_ok(&root, &["merge", "feature"]).is_err());
    p["path"] = json!("code.txt");
    let c = handle(&b, "git_conflict", &p).unwrap();
    assert_eq!(c["ours"], "main\n");
    assert_eq!(c["theirs"], "feature\n");
    assert!(handle(&b, "git_resolve", &p).is_err());
    assert!(handle(&b, "git_merge_continue", &p).is_err());
    assert_eq!(b.handle("git_status", &p).unwrap()["mergeInProgress"], true);
    fs::write(root.join("code.txt"), "resolved\n").unwrap();
    handle(&b, "git_resolve", &p).unwrap();
    handle(&b, "git_merge_continue", &p).unwrap();
    assert_eq!(
        b.handle("git_status", &p).unwrap()["mergeInProgress"],
        false
    );
    assert!(handle(&b, "git_merge_continue", &p).is_err());
    p["ref"] = json!("refs/heads/feature");
    handle(&b, "git_branch_delete", &p).unwrap();
}
#[test]
fn branch_switch_preserves_hidden_dependencies_stashes_and_compatible_edits() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().canonicalize().unwrap();
    init(&root);
    let b = Backend::fixture(&root);
    let mut p =
        json!({"root":friendly(&root),"ref":"refs/heads/main","name":"feature/new","switch":true});
    fs::create_dir(root.join("node_modules")).unwrap();
    for i in 0..1000 {
        fs::write(root.join(format!("node_modules/{i}.js")), "dependency\n").unwrap();
    }
    fs::write(root.join("notes.txt"), "stashed work\n").unwrap();
    handle(
        &b,
        "git_stash_create",
        &json!({"root":friendly(&root),"message":"keep this stash"}),
    )
    .unwrap();
    let stashes = handle(&b, "git_stashes", &p).unwrap();
    assert!(
        b.handle("git_status", &p).unwrap()["entries"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    handle(&b, "git_branch_create", &p).unwrap();
    assert_eq!(
        String::from_utf8_lossy(&git_ok(&root, &["branch", "--show-current"]).unwrap()).trim(),
        "feature/new"
    );
    handle(&b, "git_switch", &p).unwrap(); // back to main despite hidden untracked files
    assert_eq!(handle(&b, "git_stashes", &p).unwrap(), stashes);
    fs::write(root.join("code.txt"), "compatible edit\n").unwrap();
    git_ok(&root, &["add", "code.txt"]).unwrap();
    fs::write(root.join("code.txt"), "compatible unsaved-to-index edit\n").unwrap();
    fs::write(root.join("new.txt"), "untracked work\n").unwrap();
    let index = git_ok(&root, &["diff", "--cached"]).unwrap();
    p["ref"] = json!("refs/heads/feature/new");
    handle(&b, "git_switch", &p).unwrap();
    assert_eq!(index, git_ok(&root, &["diff", "--cached"]).unwrap());
    assert_eq!(
        fs::read_to_string(root.join("code.txt")).unwrap(),
        "compatible unsaved-to-index edit\n"
    );
    assert!(root.join("new.txt").exists());
    assert!(root.join("node_modules/999.js").exists());
    assert_eq!(handle(&b, "git_stashes", &p).unwrap(), stashes);
}
#[test]
fn branch_switch_refuses_real_overwrites_and_failed_create_is_atomic() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().canonicalize().unwrap();
    init(&root);
    git_ok(&root, &["switch", "-c", "target"]).unwrap();
    fs::write(root.join("code.txt"), "target\n").unwrap();
    fs::write(root.join("collision.txt"), "tracked on target\n").unwrap();
    git_ok(&root, &["add", "."]).unwrap();
    git_ok(&root, &["commit", "-m", "target content"]).unwrap();
    git_ok(&root, &["switch", "main"]).unwrap();
    let b = Backend::fixture(&root);
    let p = json!({"root":friendly(&root),"ref":"refs/heads/target","name":"must-not-be-created","switch":true});
    fs::write(root.join("code.txt"), "local edit\n").unwrap();
    assert!(handle(&b, "git_switch", &p).is_err());
    assert!(handle(&b, "git_branch_create", &p).is_err());
    assert!(
        git_ok(
            &root,
            &["show-ref", "--verify", "refs/heads/must-not-be-created"]
        )
        .is_err()
    );
    assert_eq!(
        fs::read_to_string(root.join("code.txt")).unwrap(),
        "local edit\n"
    );
    assert_eq!(
        String::from_utf8_lossy(&git_ok(&root, &["branch", "--show-current"]).unwrap()).trim(),
        "main"
    );
    // An untracked collision, even ignored, must never be overwritten by switching.
    fs::write(root.join("code.txt"), "base\n").unwrap();
    fs::write(root.join("collision.txt"), "keep untracked\n").unwrap();
    assert!(handle(&b, "git_switch", &p).is_err());
    fs::write(root.join(".git/info/exclude"), "collision.txt\n").unwrap();
    assert!(handle(&b, "git_switch", &p).is_err());
    assert_eq!(
        fs::read_to_string(root.join("collision.txt")).unwrap(),
        "keep untracked\n"
    );
    assert!(
        handle(&b, "git_stashes", &p)
            .unwrap()
            .as_array()
            .unwrap()
            .is_empty()
    );
}
#[test]
fn images_and_preview_scoped_paths() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().canonicalize().unwrap();
    let b = Backend::fixture(&root);
    fs::write(
        root.join("image.png"),
        include_bytes!("../assets/speedcode.png"),
    )
    .unwrap();
    fs::write(root.join("a b.html"), "<h1>Hello</h1>").unwrap();
    let mut p = json!({"root":friendly(&root),"path":"image.png"});
    let v = handle(&b, "read_image", &p).unwrap();
    assert!(
        v["dataUrl"]
            .as_str()
            .unwrap()
            .starts_with("data:image/png;base64,")
    );
    p["path"] = json!("../outside.png");
    assert!(handle(&b, "read_image", &p).is_err());
    p["path"] = json!("a b.html");
    assert!(preview_url(&b, &p).unwrap().contains("a%20b.html"));
    assert!(preview_url(&b, &json!({"url":"javascript:alert(1)"})).is_err());
    assert!(preview_url(&b, &json!({"url":"https://user:password@example.com"})).is_err());
}
#[test]
fn jsonc_launch_and_task_generation() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().canonicalize().unwrap();
    fs::create_dir(root.join(".vscode")).unwrap();
    fs::write(root.join(".vscode/launch.json"),r#"{// comment
      "configurations":[{"name":"API","type":"coreclr","request":"launch","program":"${workspaceFolder}/bin/api.dll","preLaunchTask":"build","args":["a'b","http://localhost"],"env":{"TEST":"ok"},},],
    }"#).unwrap();
    fs::write(root.join(".vscode/tasks.json"),r#"{"tasks":[{"label":"build","type":"process","command":"dotnet","args":["build","${workspaceFolder}/api.csproj"]}]}"#).unwrap();
    let l = Launcher {
        sources: Mutex::new(HashMap::new()),
        catalog: root.join("sources"),
    };
    let listing = l.list(&root, false).unwrap();
    assert_eq!(listing["configs"][0]["supported"], true);
    let p = json!({"index":0,"hash":listing["hash"]});
    let launch = l.prepare(&root, &p).unwrap();
    assert!(launch.script.contains("preLaunchTask falhou"));
    assert!(launch.script.contains("'a''b'"));
    assert!(launch.script.contains("& 'dotnet'"));
    assert!(
        l.prepare(&root, &json!({"index":0,"hash":"stale"}))
            .is_err()
    );
    assert!(expand("${command:pick}", &root).is_err());
}
#[test]
fn remote_tracking_and_pull_conflicts() {
    let temp = tempfile::tempdir().unwrap();
    let a = temp.path().join("a");
    let peer = temp.path().join("peer");
    let remote = temp.path().join("remote.git");
    fs::create_dir(&a).unwrap();
    init(&a);
    git_ok(temp.path(), &["init", "--bare", remote.to_str().unwrap()]).unwrap();
    git_ok(&a, &["remote", "add", "origin", remote.to_str().unwrap()]).unwrap();
    git_ok(&a, &["push", "-u", "origin", "main"]).unwrap();
    git_ok(
        temp.path(),
        &[
            "clone",
            "-b",
            "main",
            remote.to_str().unwrap(),
            peer.to_str().unwrap(),
        ],
    )
    .unwrap();
    git_ok(&peer, &["config", "user.name", "test"]).unwrap();
    git_ok(&peer, &["config", "user.email", "test@example.invalid"]).unwrap();
    git_ok(&peer, &["switch", "-c", "cloud-only"]).unwrap();
    git_ok(&peer, &["push", "-u", "origin", "cloud-only"]).unwrap();
    let root = a.canonicalize().unwrap();
    let b = Backend::fixture(&root);
    let mut p = json!({"root":friendly(&root),"action":"fetch"});
    b.handle("git_action", &p).unwrap();
    let bs = handle(&b, "git_branches", &p).unwrap();
    assert!(
        bs.as_array()
            .unwrap()
            .iter()
            .any(|x| x["ref"] == "refs/remotes/origin/cloud-only" && x["remote"] == true)
    );
    p["ref"] = json!("refs/remotes/origin/cloud-only");
    handle(&b, "git_switch", &p).unwrap();
    assert_eq!(
        String::from_utf8_lossy(&git_ok(&root, &["branch", "--show-current"]).unwrap()).trim(),
        "cloud-only"
    );
    p["ref"] = json!("refs/heads/main");
    handle(&b, "git_switch", &p).unwrap();
    fs::write(a.join("code.txt"), "local\n").unwrap();
    git_ok(&a, &["commit", "-am", "local"]).unwrap();
    git_ok(&peer, &["switch", "main"]).unwrap();
    fs::write(peer.join("code.txt"), "remote\n").unwrap();
    git_ok(&peer, &["commit", "-am", "remote"]).unwrap();
    git_ok(&peer, &["push"]).unwrap();
    p["action"] = json!("pull");
    assert!(b.handle("git_action", &p).is_err());
    p["path"] = json!("code.txt");
    assert_eq!(
        handle(&b, "git_conflict", &p).unwrap()["theirs"],
        "remote\n"
    );
    assert_eq!(b.handle("git_status", &p).unwrap()["mergeInProgress"], true);
    handle(&b, "git_merge_abort", &p).unwrap();
    assert_eq!(
        fs::read_to_string(a.join("code.txt"))
            .unwrap()
            .replace("\r\n", "\n"),
        "local\n"
    );
}
#[test]
fn windows_overrides_and_launch_settings() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().canonicalize().unwrap();
    fs::create_dir(root.join(".vscode")).unwrap();
    fs::create_dir(root.join("Properties")).unwrap();
    fs::write(root.join(".vscode/launch.json"),r#"{"configurations":[{"name":"API","type":"coreclr","request":"launch","program":"bad.dll","launchSettingsProfile":"http","env":{"APP":"override"},"windows":{"program":"${workspaceFolder}/api.dll"}}]}"#).unwrap();
    fs::write(root.join("Properties/launchSettings.json"),r#"{"profiles":{"http":{"commandName":"Project","launchBrowser":true,"launchUrl":"swagger","applicationUrl":"http://localhost:5555","environmentVariables":{"APP":"profile"}}}}"#).unwrap();
    let l = Launcher {
        sources: Mutex::new(HashMap::new()),
        catalog: root.join("sources"),
    };
    let h = l.list(&root, false).unwrap()["hash"].clone();
    let run = l.prepare(&root, &json!({"index":0,"hash":h})).unwrap();
    assert!(!run.script.contains("bad.dll"));
    assert!(run.script.contains("ASPNETCORE_URLS"));
    assert!(run.script.find("'profile'").unwrap() < run.script.find("'override'").unwrap());
    assert_eq!(run.ready["uriFormat"], "%s/swagger");
}
#[test]
#[ignore = "Requires .NET 10 SDK and performs a real build/run"]
fn real_dotnet_launch_build_serve_and_stop() {
    use crate::terminal::Terminals;
    use std::time::{Duration, Instant};
    // Exercise both documented layouts through the same runner used by Play/F5.
    for nested in [false, true] {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().canonicalize().unwrap();
        let project = if nested {
            root.join("examples/dotnet-run")
        } else {
            root.clone()
        };
        fs::create_dir_all(&project).unwrap();
        fs::create_dir(root.join(".vscode")).unwrap();
        fs::write(
            project.join("Api.csproj"),
            include_str!("../examples/dotnet-run/Api.csproj"),
        )
        .unwrap();
        fs::write(
            project.join("Program.cs"),
            include_str!("../examples/dotnet-run/Program.cs"),
        )
        .unwrap();
        fs::write(
            root.join(".vscode/tasks.json"),
            if nested {
                include_str!("../.vscode/tasks.json")
            } else {
                include_str!("../examples/dotnet-run/.vscode/tasks.json")
            },
        )
        .unwrap();
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        fs::write(
            root.join(".vscode/launch.json"),
            (if nested {
                include_str!("../.vscode/launch.json")
            } else {
                include_str!("../examples/dotnet-run/.vscode/launch.json")
            })
            .replace("51879", &port.to_string()),
        )
        .unwrap();
        let l = Launcher {
            sources: Mutex::new(HashMap::new()),
            catalog: root.join("sources"),
        };
        let listing = l.list(&root, false).unwrap();
        let launch = l
            .prepare(&root, &json!({"index":0,"hash":listing["hash"]}))
            .unwrap();
        assert_eq!(launch.ready["action"], "openExternally");
        assert_eq!(launch.ready["uriFormat"], "%s/swagger");
        let t = Terminals::new();
        let data = t
            .launch(&root, ".NET test", &launch.script, 120, 30)
            .unwrap();
        let id = data["id"].as_u64().unwrap();
        let deadline = Instant::now();
        let mut output = String::new();
        let mut ready = false;
        while deadline.elapsed() < Duration::from_secs(60) {
            let p = t.poll(id).unwrap();
            let bytes = STANDARD.decode(p["data"].as_str().unwrap()).unwrap();
            if bytes.windows(4).any(|w| w == b"\x1b[6n") {
                t.input(id, "\x1b[1;1R").unwrap();
            }
            output.push_str(&String::from_utf8_lossy(&bytes));
            if output.contains("Now listening on:") {
                ready = true;
                break;
            }
            if !p["exit"].is_null() {
                break;
            }
            std::thread::sleep(Duration::from_millis(80));
        }
        let responses: Vec<_> = if ready {
            [
                "/",
                "/health",
                "/swagger/index.html",
                "/swagger/v1/swagger.json",
                "/swagger/swagger-ui-bundle.js",
                "/swagger/swagger-ui.css",
            ]
            .into_iter()
            .map(|path| {
                crate::backend::hidden_command("curl.exe")
                    .args([
                        "--fail",
                        "--silent",
                        "--max-time",
                        "5",
                        &format!("http://127.0.0.1:{port}{path}"),
                    ])
                    .output()
                    .ok()
            })
            .collect()
        } else {
            Vec::new()
        };
        t.close(id).unwrap();
        assert!(ready, "{output}");
        let response = responses[0].as_ref().expect("Root HTTP request failed");
        assert!(
            response.status.success(),
            "Root HTTP request returned an error"
        );
        assert_eq!(
            String::from_utf8_lossy(&response.stdout),
            "SpeedCode .NET launch validation OK"
        );
        let health = responses[1].as_ref().expect("Health HTTP request failed");
        assert!(
            health.status.success(),
            "Health HTTP request returned an error"
        );
        let body: serde_json::Value = serde_json::from_slice(&health.stdout).unwrap();
        assert_eq!(body["status"], "ok");
        assert_eq!(body["application"], "SpeedCode Example");
        for response in &responses[2..] {
            assert!(
                response
                    .as_ref()
                    .expect("Swagger request failed")
                    .status
                    .success(),
                "Swagger HTTP returned an error"
            );
        }
        assert!(
            String::from_utf8_lossy(&responses[2].as_ref().unwrap().stdout)
                .contains("swagger-ui-bundle.js"),
            "Swagger UI HTML missing"
        );
        let spec: serde_json::Value =
            serde_json::from_slice(&responses[3].as_ref().unwrap().stdout).unwrap();
        assert_eq!(spec["info"]["version"], "v1");
        assert!(
            spec["paths"]["/health"]["get"]["responses"]["200"].is_object(),
            "Health missing from OpenAPI document"
        );
        assert!(
            spec["paths"]["/"]["get"].is_object(),
            "Root missing from OpenAPI document"
        );
        assert!(
            std::net::TcpStream::connect(format!("127.0.0.1:{port}")).is_err(),
            "Stopped runner left server alive"
        );
        println!(
            "Validated {} layout: build, HTTP / and /health, Swagger UI/JSON/assets, stop",
            if nested {
                "repository-root"
            } else {
                "standalone"
            }
        );
    }
}
#[test]
fn image_preview_rejects_oversized_surface_before_rendering() {
    use image::ImageEncoder;
    let mut bytes = Vec::new();
    image::codecs::png::PngEncoder::new(&mut bytes)
        .write_image(&[255, 0, 0], 1, 1, image::ExtendedColorType::Rgb8)
        .unwrap();
    assert!(super::validate_image(&bytes, "png").is_ok());
    assert!(super::validate_image(&bytes, "svg").is_err());
    let mut bytes = Vec::new();
    let pixels = vec![0u8; 3000 * 3000];
    image::codecs::png::PngEncoder::new(&mut bytes)
        .write_image(&pixels, 3000, 3000, image::ExtendedColorType::L8)
        .unwrap();
    assert!(bytes.len() < 1024 * 1024);
    assert!(
        super::validate_image(&bytes, "png")
            .unwrap_err()
            .contains("megapixels")
    );
    assert!(super::validate_image(b"not an image", "jpeg").is_err());
}
