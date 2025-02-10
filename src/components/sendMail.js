document
  .querySelector(".formulario")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    let nameValue = document.getElementById("name").value;
    let emailValue = document.getElementById("email").value;
    let infoValue = document.getElementById("info").value;
    let asuntoValue = document.getElementById("asunto").value;

    const data = {
      name: nameValue,
      from: emailValue,
      message: infoValue,
      subject: asuntoValue,
    };

    await sendinfotobackend(data);
    const alert = document.querySelectorAll("alert");
    alert.classname.add("alertActive");
    setTimeout(() => {
      alert.classname.remove("alertActive");
    }, 1000);
  });

async function sendinfotobackend(data) {
  try {
    const response = await fetch(
      " https://form-processor-production.up.railway.app/api/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error("Error al enviar los datos");
    }

    const result = await response.json();
    console.log("Respuesta del backend:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}
