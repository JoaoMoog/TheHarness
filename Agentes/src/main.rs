#![cfg_attr(
    all(target_os = "windows", not(debug_assertions)),
    windows_subsystem = "windows"
)]

use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::SystemTime,
};

const MAX_EDIT_BYTES: u64 = 2 * 1024 * 1024;

slint::slint! {
    import { Button, LineEdit, TextEdit } from "std-widgets.slint";

    component RepoRow inherits Rectangle {
        in property <string> label;
        in property <bool> selected;
        callback activated();

        height: 50px;
        background: selected ? #243047 : #121722;
        border-radius: 6px;
        Text {
            x: 10px;
            y: 0px;
            width: parent.width - 20px;
            height: parent.height;
            text: label;
            color: selected ? #f3f7ff : #d8e0ef;
            font-size: 13px;
            vertical-alignment: center;
            overflow: elide;
        }
        TouchArea { clicked => { root.activated(); } }
    }

    component EntryRow inherits Rectangle {
        in property <string> label;
        in property <bool> directory;
        callback activated();

        height: 29px;
        background: #121722;
        Text {
            x: 9px;
            y: 0px;
            width: parent.width - 18px;
            height: parent.height;
            text: (directory ? "▸  " : "    ") + label;
            color: directory ? #a9c8fa : #d8e0ef;
            font-size: 12px;
            vertical-alignment: center;
            overflow: elide;
        }
        TouchArea { clicked => { root.activated(); } }
    }

    export component SpeedCode inherits Window {
        title: "SpeedCode — Local";
        preferred-width: 1420px;
        preferred-height: 780px;
        min-width: 980px;
        min-height: 650px;
        background: #0e1118;

        in-out property <[string]> repo-names;
        in-out property <[string]> entry-names;
        in-out property <[bool]> entry-directories;
        in-out property <int> active-repo-index: -1;
        in-out property <int> entry-count: 0;
        in-out property <string> repo-path-input;
        in-out property <string> workspace-label: "Nenhum repositório aberto";
        in-out property <string> current-directory-label: "";
        in-out property <string> current-path-label: "Abra um arquivo para editar";
        in-out property <string> editor-text;
        in-out property <string> status-message: "Adicione um repositório para começar";
        in-out property <bool> dirty: false;
        in-out property <bool> has-file: false;
        in-out property <bool> can-go-up: false;

        callback add-repository(string);
        callback browse-repository();
        callback select-repository(int);
        callback activate-entry(int);
        callback go-up();
        callback editor-changed(string);
        callback save-file();
        callback open-powershell();

        Rectangle {
            background: #0e1118;
            VerticalLayout {
                spacing: 0px;

                Rectangle {
                    height: 54px;
                    background: #151b27;
                    border-width: 1px;
                    border-color: #273044;
                    HorizontalLayout {
                        padding-left: 18px;
                        padding-right: 18px;
                        spacing: 14px;
                        Text {
                            width: 210px;
                            text: "SpeedCode";
                            color: #f4f7fb;
                            font-size: 18px;
                            font-weight: 700;
                            vertical-alignment: center;
                        }
                        Rectangle { width: 1px; background: #344057; }
                        Text {
                            text: root.workspace-label;
                            color: #aebbd0;
                            font-size: 12px;
                            vertical-alignment: center;
                            overflow: elide;
                        }
                        Rectangle { horizontal-stretch: 1; }
                        Text {
                            width: 190px;
                            text: "Local · sem dados simulados";
                            color: #72d69a;
                            font-size: 11px;
                            horizontal-alignment: right;
                            vertical-alignment: center;
                        }
                    }
                }

                HorizontalLayout {
                    spacing: 0px;

                    Rectangle {
                        width: 245px;
                        background: #121722;
                        border-width: 1px;
                        border-color: #273044;
                        VerticalLayout {
                            padding: 10px;
                            spacing: 7px;
                            Text {
                                height: 22px;
                                text: "REPOSITÓRIOS";
                                color: #8290a8;
                                font-size: 11px;
                                font-weight: 700;
                                vertical-alignment: center;
                            }
                            for name[index] in root.repo-names: RepoRow {
                                label: name;
                                selected: root.active-repo-index == index;
                                activated => { root.select-repository(index); }
                            }
                            Rectangle { vertical-stretch: 1; }
                            Text {
                                text: "Adicionar pasta ou repositório";
                                color: #aebbd0;
                                font-size: 11px;
                            }
                            LineEdit {
                                height: 34px;
                                text <=> root.repo-path-input;
                                placeholder-text: "C:\\caminho\\do\\projeto";
                            }
                            HorizontalLayout {
                                height: 34px;
                                spacing: 5px;
                                Button {
                                    horizontal-stretch: 1;
                                    text: "Procurar…";
                                    clicked => { root.browse-repository(); }
                                }
                                Button {
                                    width: 78px;
                                    text: "Adicionar";
                                    clicked => { root.add-repository(root.repo-path-input); }
                                }
                            }
                            Text {
                                height: 38px;
                                text: "O catálogo é local; adicionar uma pasta não copia nem apaga arquivos.";
                                color: #748198;
                                font-size: 10px;
                                wrap: word-wrap;
                            }
                        }
                    }

                    Rectangle {
                        width: 270px;
                        background: #111723;
                        border-width: 1px;
                        border-color: #273044;
                        VerticalLayout {
                            padding: 10px;
                            spacing: 5px;
                            HorizontalLayout {
                                height: 29px;
                                Text {
                                    text: "ARQUIVOS";
                                    color: #8290a8;
                                    font-size: 11px;
                                    font-weight: 700;
                                    vertical-alignment: center;
                                }
                                Rectangle { horizontal-stretch: 1; }
                                Button {
                                    width: 58px;
                                    text: "Acima";
                                    enabled: root.can-go-up;
                                    clicked => { root.go-up(); }
                                }
                            }
                            Text {
                                height: 37px;
                                text: root.current-directory-label;
                                color: #8fa0ba;
                                font-size: 10px;
                                wrap: word-wrap;
                                overflow: elide;
                            }
                            Rectangle { height: 1px; background: #273044; }
                            for name[index] in root.entry-names: EntryRow {
                                label: name;
                                directory: root.entry-directories[index];
                                activated => { root.activate-entry(index); }
                            }
                            if root.entry-count == 0: Text {
                                text: "Pasta vazia ou nenhum repositório selecionado.";
                                color: #748198;
                                font-size: 11px;
                                wrap: word-wrap;
                            }
                            Rectangle { vertical-stretch: 1; }
                            Text {
                                text: "Pastas geradas e links simbólicos são omitidos.";
                                color: #748198;
                                font-size: 10px;
                                wrap: word-wrap;
                            }
                        }
                    }

                    Rectangle {
                        horizontal-stretch: 1;
                        background: #0e1118;
                        VerticalLayout {
                            spacing: 0px;
                            Rectangle {
                                height: 44px;
                                background: #151b27;
                                border-width: 1px;
                                border-color: #273044;
                                HorizontalLayout {
                                    padding-left: 12px;
                                    padding-right: 12px;
                                    spacing: 7px;
                                    Text {
                                        horizontal-stretch: 1;
                                        text: root.current-path-label;
                                        color: #eff4ff;
                                        font-size: 12px;
                                        vertical-alignment: center;
                                        overflow: elide;
                                    }
                                    Text {
                                        width: 18px;
                                        text: root.dirty ? "●" : "";
                                        color: #f0bb67;
                                        font-size: 12px;
                                        vertical-alignment: center;
                                    }
                                    Button {
                                        width: 76px;
                                        text: "Salvar";
                                        enabled: root.has-file && root.dirty;
                                        clicked => { root.save-file(); }
                                    }
                                }
                            }
                            Rectangle {
                                horizontal-stretch: 1;
                                background: #0e1118;
                                TextEdit {
                                    x: 12px;
                                    y: 12px;
                                    width: parent.width - 24px;
                                    height: parent.height - 24px;
                                    text <=> root.editor-text;
                                    font-family: "Cascadia Mono";
                                    font-size: 13px;
                                    read-only: !root.has-file;
                                    edited => {
                                        root.dirty = true;
                                        root.editor-changed(root.editor-text);
                                    }
                                }
                            }
                            Rectangle {
                                height: 148px;
                                background: #111722;
                                border-width: 1px;
                                border-color: #273044;
                                VerticalLayout {
                                    padding-left: 14px;
                                    padding-right: 14px;
                                    spacing: 5px;
                                    HorizontalLayout {
                                        height: 42px;
                                        Text {
                                            text: "TERMINAL";
                                            color: #b6c3d9;
                                            font-size: 11px;
                                            font-weight: 700;
                                            vertical-alignment: center;
                                        }
                                        Rectangle { horizontal-stretch: 1; }
                                        Button {
                                            width: 190px;
                                            text: "Abrir PowerShell";
                                            enabled: root.active-repo-index >= 0;
                                            clicked => { root.open-powershell(); }
                                        }
                                    }
                                    Text {
                                        text: "Abre uma janela real do Windows PowerShell no diretório do repositório ativo. Use nela seus CLIs e comandos interativos.";
                                        color: #8c9bb1;
                                        font-size: 11px;
                                        wrap: word-wrap;
                                    }
                                    Text {
                                        text: "O terminal é externo à IDE; nenhum comando é executado automaticamente.";
                                        color: #748198;
                                        font-size: 10px;
                                        wrap: word-wrap;
                                    }
                                }
                            }
                        }
                    }
                }

                Rectangle {
                    height: 28px;
                    background: #21314a;
                    HorizontalLayout {
                        padding-left: 14px;
                        padding-right: 14px;
                        Text {
                            horizontal-stretch: 1;
                            text: root.status-message;
                            color: #e7f0ff;
                            font-size: 11px;
                            vertical-alignment: center;
                            overflow: elide;
                        }
                        Text {
                            width: 130px;
                            text: root.dirty ? "Não salvo" : "UTF-8";
                            color: #c2d4ee;
                            font-size: 11px;
                            horizontal-alignment: right;
                            vertical-alignment: center;
                        }
                    }
                }
            }
        }
    }
}

#[derive(Clone, Debug)]
struct FileEntry {
    path: PathBuf,
    name: String,
    is_dir: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct DiskStamp {
    modified: Option<SystemTime>,
    len: u64,
}

struct AppState {
    repositories: Vec<PathBuf>,
    active_repo: Option<usize>,
    current_directory: Option<PathBuf>,
    entries: Vec<FileEntry>,
    current_file: Option<PathBuf>,
    editor_text: String,
    original_stamp: Option<DiskStamp>,
    line_ending: &'static str,
    has_bom: bool,
    dirty: bool,
    status: String,
}

impl AppState {
    fn load() -> Self {
        let mut repositories = load_catalog();
        if repositories.is_empty() {
            let initial = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            if let Ok(path) = initial.canonicalize() {
                if path.is_dir() {
                    repositories.push(path);
                    save_catalog(&repositories);
                }
            }
        }
        let active_repo = (!repositories.is_empty()).then_some(0);
        let current_directory = active_repo.map(|index| repositories[index].clone());
        let status = active_repo.map_or_else(
            || "Adicione um repositório para começar".into(),
            |index| format!("Repositório ativo: {}", display_path(&repositories[index])),
        );
        let mut state = Self {
            repositories,
            active_repo,
            current_directory,
            entries: Vec::new(),
            current_file: None,
            editor_text: String::new(),
            original_stamp: None,
            line_ending: "\n",
            has_bom: false,
            dirty: false,
            status,
        };
        state.refresh_entries();
        state
    }

    fn active_root(&self) -> Option<&Path> {
        self.active_repo
            .and_then(|index| self.repositories.get(index))
            .map(PathBuf::as_path)
    }

    fn refresh_entries(&mut self) {
        let Some(root) = self.active_root().map(Path::to_path_buf) else {
            self.entries.clear();
            return;
        };
        let Some(directory) = self.current_directory.as_ref() else {
            self.entries.clear();
            return;
        };
        match list_entries(&root, directory) {
            Ok(entries) => self.entries = entries,
            Err(error) => {
                self.entries.clear();
                self.status = format!("Não foi possível listar a pasta: {error}");
            }
        }
    }

    fn add_repository(&mut self, input: &str) {
        let typed = input.trim().trim_matches('"');
        if typed.is_empty() {
            self.status = "Informe um caminho ou use Procurar…".into();
            return;
        }
        match PathBuf::from(typed).canonicalize() {
            Ok(root) if root.is_dir() => {
                if let Some(index) = self
                    .repositories
                    .iter()
                    .position(|path| same_path(path, &root))
                {
                    self.select_repository(index);
                    self.status = format!("Repositório já cadastrado: {}", display_path(&root));
                    return;
                }
                self.repositories.push(root.clone());
                save_catalog(&self.repositories);
                self.select_repository(self.repositories.len() - 1);
                self.status = format!("Repositório adicionado: {}", display_path(&root));
            }
            Ok(_) => self.status = "O caminho escolhido não é uma pasta.".into(),
            Err(error) => self.status = format!("Caminho inválido ou inacessível: {error}"),
        }
    }

    fn select_repository(&mut self, index: usize) {
        if self.dirty {
            self.status = "Salve o arquivo atual antes de trocar de repositório.".into();
            return;
        }
        let Some(root) = self.repositories.get(index).cloned() else {
            self.status = "Repositório não encontrado no catálogo.".into();
            return;
        };
        self.active_repo = Some(index);
        self.current_directory = Some(root.clone());
        self.close_file();
        self.status = format!("Repositório ativo: {}", display_path(&root));
        self.refresh_entries();
    }

    fn activate_entry(&mut self, index: usize) {
        if self.dirty {
            self.status = "Salve o arquivo atual antes de abrir outro.".into();
            return;
        }
        let Some(entry) = self.entries.get(index).cloned() else {
            self.status =
                "Este item da pasta já não existe. Atualize selecionando o repositório.".into();
            return;
        };
        if entry.is_dir {
            self.status = format!("Pasta aberta: {}", display_path(&entry.path));
            self.current_directory = Some(entry.path);
            self.refresh_entries();
            return;
        }
        self.open_file(&entry.path);
    }

    fn go_up(&mut self) {
        if self.dirty {
            self.status = "Salve o arquivo atual antes de navegar para outra pasta.".into();
            return;
        }
        let (Some(root), Some(current)) = (self.active_root(), self.current_directory.as_ref())
        else {
            return;
        };
        if let Some(parent) = current.parent().filter(|path| path.starts_with(root)) {
            self.status = format!("Pasta aberta: {}", display_path(parent));
            self.current_directory = Some(parent.to_path_buf());
            self.refresh_entries();
        }
    }

    fn open_file(&mut self, path: &Path) {
        let Some(root) = self.active_root().map(Path::to_path_buf) else {
            self.status = "Selecione um repositório primeiro.".into();
            return;
        };
        if let Err(error) = validate_file_path(&root, path) {
            self.status = format!("Arquivo bloqueado: {error}");
            return;
        }
        let metadata = match fs::metadata(path) {
            Ok(metadata) => metadata,
            Err(error) => {
                self.status = format!("Não foi possível abrir o arquivo: {error}");
                return;
            }
        };
        if metadata.len() > MAX_EDIT_BYTES {
            self.status = format!(
                "Arquivo maior que 2 MiB; edição bloqueada para evitar travamento: {}",
                path.display()
            );
            return;
        }
        let bytes = match fs::read(path) {
            Ok(bytes) => bytes,
            Err(error) => {
                self.status = format!("Falha ao ler arquivo: {error}");
                return;
            }
        };
        if bytes.contains(&0) {
            self.status = "Arquivo binário detectado; ele não será aberto para edição.".into();
            return;
        }
        self.has_bom = bytes.starts_with(&[0xef, 0xbb, 0xbf]);
        let content_bytes = if self.has_bom {
            &bytes[3..]
        } else {
            bytes.as_slice()
        };
        let content = match std::str::from_utf8(content_bytes) {
            Ok(content) => content,
            Err(_) => {
                self.status = "Este arquivo não é UTF-8; ele não será alterado.".into();
                return;
            }
        };
        self.line_ending = if content.contains("\r\n") {
            "\r\n"
        } else {
            "\n"
        };
        self.editor_text = content.replace("\r\n", "\n");
        self.current_file = Some(path.to_path_buf());
        self.original_stamp = Some(stamp(&metadata));
        self.dirty = false;
        self.status = format!("Arquivo aberto: {}", display_path(path));
    }

    fn save_file(&mut self) {
        let (Some(root), Some(path), Some(original_stamp)) = (
            self.active_root().map(Path::to_path_buf),
            self.current_file.clone(),
            self.original_stamp,
        ) else {
            self.status = "Nenhum arquivo aberto para salvar.".into();
            return;
        };
        if let Err(error) = validate_file_path(&root, &path) {
            self.status = format!("Salvamento bloqueado: {error}");
            return;
        }
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) => {
                self.status = format!("O arquivo desapareceu ou não pode ser lido: {error}");
                return;
            }
        };
        if stamp(&metadata) != original_stamp {
            self.status = "O arquivo mudou no disco desde que foi aberto. O buffer foi preservado; reabra após copiar suas alterações.".into();
            return;
        }
        let normalized = self.editor_text.replace("\r\n", "\n");
        let text = if self.line_ending == "\n" {
            normalized
        } else {
            normalized.replace('\n', self.line_ending)
        };
        let mut bytes = Vec::with_capacity(text.len() + usize::from(self.has_bom) * 3);
        if self.has_bom {
            bytes.extend_from_slice(&[0xef, 0xbb, 0xbf]);
        }
        bytes.extend_from_slice(text.as_bytes());
        match fs::write(&path, &bytes).and_then(|()| fs::metadata(&path)) {
            Ok(metadata) => {
                self.original_stamp = Some(stamp(&metadata));
                self.dirty = false;
                self.status = format!("Salvo em disco: {}", display_path(&path));
            }
            Err(error) => {
                self.status = format!("Falha ao salvar; o buffer continua aberto: {error}")
            }
        }
    }

    fn close_file(&mut self) {
        self.current_file = None;
        self.editor_text.clear();
        self.original_stamp = None;
        self.dirty = false;
        self.has_bom = false;
        self.line_ending = "\n";
    }
}

fn catalog_path() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .map(|base| base.join("SpeedCode").join("repositories.txt"))
}

fn load_catalog() -> Vec<PathBuf> {
    let Some(path) = catalog_path() else {
        return Vec::new();
    };
    let Ok(contents) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let mut repositories: Vec<PathBuf> = Vec::new();
    for line in contents.lines().filter(|line| !line.trim().is_empty()) {
        if let Ok(root) = PathBuf::from(line).canonicalize() {
            if root.is_dir()
                && !repositories
                    .iter()
                    .any(|existing| same_path(existing, &root))
            {
                repositories.push(root);
            }
        }
    }
    repositories
}

fn save_catalog(repositories: &[PathBuf]) {
    let Some(path) = catalog_path() else { return };
    let Some(parent) = path.parent() else { return };
    if fs::create_dir_all(parent).is_err() {
        return;
    }
    let contents = repositories
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("\n");
    let _ = fs::write(path, contents);
}

fn same_path(left: &Path, right: &Path) -> bool {
    left.to_string_lossy()
        .eq_ignore_ascii_case(&right.to_string_lossy())
}

fn display_path(path: &Path) -> String {
    let value = path.to_string_lossy();
    if let Some(unc_path) = value.strip_prefix("\\\\?\\UNC\\") {
        format!("\\\\{unc_path}")
    } else if let Some(path) = value.strip_prefix("\\\\?\\") {
        path.to_string()
    } else {
        value.into_owned()
    }
}

fn validate_file_path(root: &Path, file: &Path) -> Result<(), String> {
    let root = root.canonicalize().map_err(|error| error.to_string())?;
    let file_type = fs::symlink_metadata(file)
        .map_err(|error| error.to_string())?
        .file_type();
    if file_type.is_symlink() {
        return Err("links simbólicos não são abertos pelo explorador".into());
    }
    let canonical = file.canonicalize().map_err(|error| error.to_string())?;
    if !canonical.starts_with(&root) || !canonical.is_file() {
        return Err("o caminho não é um arquivo dentro do repositório ativo".into());
    }
    Ok(())
}

fn list_entries(root: &Path, directory: &Path) -> Result<Vec<FileEntry>, String> {
    let root = root.canonicalize().map_err(|error| error.to_string())?;
    let directory = directory
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !directory.starts_with(&root) || !directory.is_dir() {
        return Err("a pasta está fora do repositório ativo".into());
    }
    let mut entries = Vec::new();
    for item in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        let metadata = item.file_type().map_err(|error| error.to_string())?;
        if metadata.is_symlink() {
            continue;
        }
        let name = item.file_name().to_string_lossy().into_owned();
        if metadata.is_dir()
            && matches!(
                name.as_str(),
                ".git" | "node_modules" | ".next" | "target" | "build" | "bin" | "obj"
            )
        {
            continue;
        }
        if metadata.is_dir() || metadata.is_file() {
            entries.push(FileEntry {
                path: item.path(),
                name,
                is_dir: metadata.is_dir(),
            });
        }
    }
    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(entries)
}

fn stamp(metadata: &fs::Metadata) -> DiskStamp {
    DiskStamp {
        modified: metadata.modified().ok(),
        len: metadata.len(),
    }
}

fn refresh_ui(ui: &SpeedCode, state: &AppState) {
    ui.set_repo_names(slint::ModelRc::new(slint::VecModel::from(
        state
            .repositories
            .iter()
            .map(|path| {
                path.file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned()
                    .into()
            })
            .collect::<Vec<slint::SharedString>>(),
    )));
    ui.set_active_repo_index(state.active_repo.map_or(-1, |index| index as i32));
    ui.set_entry_names(slint::ModelRc::new(slint::VecModel::from(
        state
            .entries
            .iter()
            .map(|entry| entry.name.clone().into())
            .collect::<Vec<slint::SharedString>>(),
    )));
    ui.set_entry_directories(slint::ModelRc::new(slint::VecModel::from(
        state
            .entries
            .iter()
            .map(|entry| entry.is_dir)
            .collect::<Vec<_>>(),
    )));
    let active = state.active_root();
    ui.set_workspace_label(
        active
            .map_or_else(|| "Nenhum repositório aberto".to_string(), display_path)
            .into(),
    );
    ui.set_current_directory_label(
        state
            .current_directory
            .as_deref()
            .map_or_else(|| "Nenhuma pasta aberta".to_string(), display_path)
            .into(),
    );
    ui.set_current_path_label(
        state
            .current_file
            .as_ref()
            .map_or_else(
                || "Abra um arquivo para editar".to_string(),
                |path| display_path(path),
            )
            .into(),
    );
    ui.set_editor_text(state.editor_text.clone().into());
    ui.set_status_message(state.status.clone().into());
    ui.set_dirty(state.dirty);
    ui.set_has_file(state.current_file.is_some());
    ui.set_can_go_up(
        state
            .current_directory
            .as_ref()
            .zip(active)
            .is_some_and(|(current, root)| current != root),
    );
    ui.set_entry_count(state.entries.len() as i32);
}

fn open_power_shell(root: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("powershell.exe")
            .args(["-NoLogo", "-NoExit"])
            .current_dir(root)
            .creation_flags(0x0000_0010)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("não foi possível iniciar Windows PowerShell: {error}"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = root;
        Err("A abertura do Windows PowerShell só está disponível no Windows.".into())
    }
}

fn main() -> Result<(), slint::PlatformError> {
    let ui = SpeedCode::new()?;
    let state = std::rc::Rc::new(std::cell::RefCell::new(AppState::load()));
    refresh_ui(&ui, &state.borrow());

    {
        let weak = ui.as_weak();
        let state = state.clone();
        ui.on_add_repository(move |path| {
            let Some(ui) = weak.upgrade() else { return };
            let mut state = state.borrow_mut();
            state.add_repository(path.as_str());
            refresh_ui(&ui, &state);
        });
    }
    {
        let weak = ui.as_weak();
        let state = state.clone();
        ui.on_browse_repository(move || {
            if let Some(path) = rfd::FileDialog::new().pick_folder() {
                if let Some(ui) = weak.upgrade() {
                    let mut state = state.borrow_mut();
                    let path = path.to_string_lossy().into_owned();
                    ui.set_repo_path_input(path.clone().into());
                    state.add_repository(&path);
                    refresh_ui(&ui, &state);
                }
            }
        });
    }
    {
        let weak = ui.as_weak();
        let state = state.clone();
        ui.on_select_repository(move |index| {
            let Some(ui) = weak.upgrade() else { return };
            let mut state = state.borrow_mut();
            if index >= 0 {
                state.select_repository(index as usize);
            }
            refresh_ui(&ui, &state);
        });
    }
    {
        let weak = ui.as_weak();
        let state = state.clone();
        ui.on_activate_entry(move |index| {
            let Some(ui) = weak.upgrade() else { return };
            let mut state = state.borrow_mut();
            if index >= 0 {
                state.activate_entry(index as usize);
            }
            refresh_ui(&ui, &state);
        });
    }
    {
        let weak = ui.as_weak();
        let state = state.clone();
        ui.on_go_up(move || {
            let Some(ui) = weak.upgrade() else { return };
            let mut state = state.borrow_mut();
            state.go_up();
            refresh_ui(&ui, &state);
        });
    }
    {
        let weak = ui.as_weak();
        let state = state.clone();
        ui.on_editor_changed(move |text| {
            let mut state = state.borrow_mut();
            state.editor_text = text.to_string();
            state.dirty = true;
            if let Some(ui) = weak.upgrade() {
                refresh_ui(&ui, &state);
            }
        });
    }
    {
        let weak = ui.as_weak();
        let state = state.clone();
        ui.on_save_file(move || {
            let Some(ui) = weak.upgrade() else { return };
            let mut state = state.borrow_mut();
            state.save_file();
            refresh_ui(&ui, &state);
        });
    }
    {
        let weak = ui.as_weak();
        let state = state.clone();
        ui.on_open_powershell(move || {
            let Some(ui) = weak.upgrade() else { return };
            let mut state = state.borrow_mut();
            let result = state
                .active_root()
                .map(Path::to_path_buf)
                .ok_or_else(|| "Selecione um repositório primeiro.".to_string())
                .and_then(|root| {
                    open_power_shell(&root)
                        .map(|()| format!("Windows PowerShell aberto em {}", display_path(&root)))
                });
            state.status = result.unwrap_or_else(|error| error);
            refresh_ui(&ui, &state);
        });
    }

    ui.run()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn editor_size_limit_is_two_mib() {
        assert_eq!(MAX_EDIT_BYTES, 2_097_152);
    }

    #[test]
    fn case_insensitive_path_deduplication_matches_windows() {
        assert!(same_path(
            Path::new("C:\\Work\\App"),
            Path::new("c:\\work\\app")
        ));
        assert!(!same_path(
            Path::new("C:\\Work\\App"),
            Path::new("C:\\Work\\Other")
        ));
    }

    #[test]
    fn extended_windows_paths_are_friendly_in_the_ui() {
        assert_eq!(
            display_path(Path::new("\\\\?\\C:\\Work\\App")),
            "C:\\Work\\App"
        );
        assert_eq!(
            display_path(Path::new("\\\\?\\UNC\\server\\share\\App")),
            "\\\\server\\share\\App"
        );
    }
}
