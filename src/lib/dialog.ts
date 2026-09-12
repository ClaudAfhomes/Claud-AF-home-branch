import Swal from "sweetalert2";

export async function confirmAction(title: string, text: string) {
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Continue",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#57AB4B",
  });
  return result.isConfirmed;
}

export async function showError(text: string) {
  await Swal.fire({ title: "Something went wrong", text, icon: "error", confirmButtonColor: "#57AB4B" });
}

export async function showToast(text: string, icon: "success" | "error" = "success") {
  await Swal.fire({ toast: true, position: "top-end", timer: icon === "error" ? 5000 : 2800, timerProgressBar: true, showConfirmButton: false, icon, text });
}

export async function promptText(title: string, inputLabel: string) {
  const result = await Swal.fire({
    title,
    input: "text",
    inputLabel,
    inputValidator: (value) => value.trim() ? undefined : "Enter a value to continue.",
    showCancelButton: true,
    confirmButtonText: "Create",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#57AB4B",
  });
  return result.isConfirmed ? result.value.trim() : null;
}
