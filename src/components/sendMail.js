document
  .querySelector(".formulario")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    let nameValue = document.getElementById("name").value;
    let emailValue = document.getElementById("email").value;
    let info = document.getElementById("info").value;
    let asunto = document.getElementById("asunto").value;
  });
