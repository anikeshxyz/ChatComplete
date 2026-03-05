import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class GeminiModelsHead {
    public static void main(String[] args) {
        String apiKey = "AIzaSyCXoWzv6Nrcf6Q2U7CBz440dFuPunFeEyY";
        String urlString = "https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey;

        try {
            URL url = new URL(urlString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");

            int code = conn.getResponseCode();
            System.out.println("Response Code: " + code);

            BufferedReader in = new BufferedReader(new InputStreamReader(
                    code >= 400 ? conn.getErrorStream() : conn.getInputStream()));
            String inputLine;
            int count = 0;
            while ((inputLine = in.readLine()) != null && count < 100) {
                System.out.println(inputLine);
                count++;
            }
            in.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
