package com.chat.application.repository;

import com.chat.application.model.Group;
import com.chat.application.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GroupRepository extends JpaRepository<Group, Long> {
    List<Group> findByMembersContaining(User user);

    List<Group> findByAdmin(User admin);
}
