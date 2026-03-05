import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

public class CheckDB {
    public static void main(String[] args) {
        String url = "jdbc:mysql://localhost:3306/chatapp";
        String user = "root";
        String password = "password"; // From application.properties? Let me check

        try {
            Connection conn = DriverManager.getConnection(url, user, password);
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery("SELECT * FROM users WHERE username = 'AI Assistant'");
            if (rs.next()) {
                System.out.println("AI Assistant user found in DB: " + rs.getString("username"));
            } else {
                System.out.println("AI Assistant user NOT found in DB!");
            }
            conn.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
