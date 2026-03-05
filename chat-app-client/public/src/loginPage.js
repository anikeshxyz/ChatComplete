import { BASE_URL } from './config.js';
import { loginWithOtp, sendOtp } from "./apiService";
import { displayErrorMessages } from "./utils";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("login");
  const errorMessage = document.getElementById("error-message");
  const errorText = document.getElementById("error-text");
  const sendOtpBtn = document.getElementById("sendOtpBtn");
  const otpSection = document.getElementById("otpSection");
  const otpInput = document.getElementById("otpInput");
  const otpStatus = document.getElementById("otp-status");

  let otpSent = false;

  // Send OTP
  sendOtpBtn.addEventListener("click", async function () {
    const phoneNumber = document.getElementById("phoneNumber").value.trim();

    if (!phoneNumber) {
      displayErrorMessages("Please enter your phone number");
      return;
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = "Sending...";

    try {
      await sendOtp(phoneNumber);
      otpSent = true;
      otpSection.style.display = "flex";
      otpInput.focus();
      otpStatus.style.display = "block";
      otpStatus.className = "otp-status otp-sent";
      otpStatus.textContent = "OTP sent! Check the server terminal.";
      sendOtpBtn.textContent = "Resend";
    } catch (error) {
      displayErrorMessages(error.message || "Failed to send OTP");
      sendOtpBtn.textContent = "Send OTP";
    } finally {
      sendOtpBtn.disabled = false;
    }
  });

  // Login with OTP
  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    errorMessage.style.display = "none";
    errorText.innerHTML = "";

    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const otp = otpInput.value.trim();

    if (!phoneNumber) {
      displayErrorMessages("Phone number is required");
      return;
    }

    if (!otpSent) {
      displayErrorMessages("Please send OTP first");
      return;
    }

    if (!otp || otp.length !== 6) {
      displayErrorMessages("Please enter the 6-digit OTP");
      return;
    }

    try {
      const response = await loginWithOtp(phoneNumber, otp);

      console.log("Login response:", response);

      if (!response) {
        displayErrorMessages("Invalid response from server");
        return;
      }

      saveUserDetails(response);
      window.location.href = "chat.html";
    } catch (error) {
      console.error("Login error:", error);
      displayErrorMessages(error.message || "Login failed. Please try again.");
    }
  });
});


function saveUserDetails(response) {

  let profilePicture = response.profilePicture || '';

  profilePicture = profilePicture.replace(/['"]/g, '').trim();

  if (profilePicture && !profilePicture.startsWith('http')) {
    profilePicture = `${BASE_URL}/uploads/${profilePicture}`;
  }

  localStorage.setItem("userId", response.userId);
  localStorage.setItem("username", response.username);
  localStorage.setItem("firstname", response.firstname);
  localStorage.setItem("lastname", response.lastname);
  localStorage.setItem("email", response.email);
  localStorage.setItem("phoneNumber", response.phoneNumber);
  localStorage.setItem("profilePicture", profilePicture);
  localStorage.setItem("about", response.about || '');
  localStorage.setItem("token", response.token);
}