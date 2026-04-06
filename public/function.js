const editor = document.querySelector("#editor");
const toolbarOptions = [[{ header: [1, 2, false] }], ["bold", "italic", "underline"], [{ list: "bullet" }, { list: "ordered" }]];

const themeToggle = document.querySelector("#checkbox");
const savedTheme = localStorage.getItem("theme");
const useDarkTheme = savedTheme === "dark";

document.body.classList.toggle("dark-theme", useDarkTheme);
if (themeToggle) {
  themeToggle.checked = useDarkTheme;
  themeToggle.addEventListener("change", function () {
    const isDark = themeToggle.checked;
    document.body.classList.toggle("dark-theme", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}

if (editor) {
  const quill = new Quill("#editor", {
    theme: "snow",
    placeholder: "Write your notes here...",
    modules: {
      toolbar: toolbarOptions,
    },
  });

  const form = document.querySelector(".note_form");
  const note = document.querySelector(".noteInput");
  if (form && note) {
    form.addEventListener("submit", function () {
      note.value = quill.root.innerHTML;
    });
  }
}
const isLogin = document.querySelector(".isLogin");
const logout = document.querySelector(".logout");
if (isLogin.value === "false") {
  logout.classList.add("logout_disAper");
}

const shortBy = document.querySelector("#short_by");
if (shortBy) {
  shortBy.addEventListener("change", function () {
    this.form.submit();
  });
}