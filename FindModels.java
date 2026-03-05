import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class FindModels {
    public static void main(String[] args) {
        String apiKey = "AIzaSyCXoWzv6Nrcf6Q2U7CBz440dFuPunFeEyY";
        String urlString = "https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey;

        try {
            URL url = new java.net.URI(urlString).toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");

            BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            String inputLine;
            StringBuilder response = new StringBuilder();
            while ((inputLine = in.readLine()) != null) {
                response.append(inputLine);
            }
            in.close();

            String fullBody = response.toString();
            // Match "name": "models/..." and then find the nearest generation methods
            Pattern p = Pattern.compile("\"name\": \"(models/[^\"]+)\"");
            Matcher m = p.matcher(fullBody);

            while (m.find()) {
                String name = m.group(1);
                // Search for the next "supportedGenerationMethods" after this model name
                int nameEnd = m.end();
                int nextNameStart = fullBody.indexOf("\"name\":", nameEnd);
                String sub;
                if (nextNameStart != -1) {
                    sub = fullBody.substring(nameEnd, nextNameStart);
                } else {
                    sub = fullBody.substring(nameEnd);
                }

                if (sub.contains("generateContent")) {
                    System.out.println("Supports generateContent: " + name);
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
