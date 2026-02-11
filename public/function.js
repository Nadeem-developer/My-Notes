const editor = document.querySelector("#editor");
const toolbarOptions = [[{ header: [1, 2, false] }], ["bold", "italic", "underline"], [{ list: "bullet" }, { list: "ordered" }]];
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
  form.addEventListener("submit", function () {
    note.value = quill.root.innerHTML;
  });
}
