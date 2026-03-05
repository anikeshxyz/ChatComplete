import requests

base_url = "http://localhost:3030/api/v1"

# 1. Register User using correct names and files
data = {
    "username": "test_user_3",
    "firstname": "Test",
    "lastname": "Upload",
    "email": "test@test.com",
    "phoneNumber": "1234567893",
    "password": "Password1!",
    "confirmPassword": "Password1!",
    "about": "Testing"
}
# profilePicture string or file? Let's check UserController -> @ModelAttribute UserRegistrationRequests or what? 
# Usually Spring expects just the parts. If the user sent a string "none", we send a string.
data["profilePicture"] = "none"

res = requests.post(f"{base_url}/create-user", data=data)
print("Reg status:", res.status_code)
# print("Reg text:", res.text)

login_res = requests.post(f"{base_url}/login-user", json={"username": "test_user_3", "password": "Password1!"})
print("Login status:", login_res.status_code)

if login_res.status_code == 200:
    token = login_res.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    with open("pom.xml", "rb") as f:
        upload_res = requests.post(f"{base_url}/upload-chat-file", headers=headers, files={"file": f})
        print("Upload status:", upload_res.status_code)
        print("Upload text:", upload_res.text)
