# Forum Specification #
The goal of this forum is to facilitate discussions about Bitcoin Unlimited as an organisation and Bitcoin Unlimited Imrpovement Proposals (BUIP) using a mashup of a google docs, reddit, and wikipedia commentary styles.

## Spec Details ##
Version: 0.1.0   
Authored: 2020-01-27   

This version of the spec only covers basic forum attributes and definitions. It is not complete with a description of features beyond basic roles, permissions, and description of where/how data is to be stored.



## Definitions and Terms ##
### Post ###
The most basic unit of the forum, a post is a block of text written by a user.

### Thread ###
A thread is a series of posts in in ascending chronological order where each subsiquent post in a thread is presumably a thought, comment, or response to a previous post. A thread reads from original post to most recent post displayed from top to bottom, first to last page.

### Original Post ###
The original post (OP) is the first post in a given thread

### Original Poster ###
The original poster (OP) is the author of the first post in a given thread

### Subthread ###
A subthread is a thread that was created by a user in specific relation to a post, excluding the original post, previously issued by another user in a thread. The purpose of a subthread is to help organise conversations as not all conversations are linear and sometimes tangent away from the original point. For sanity reasons, it is not possible for a subthread to have a subthread.



## Security ##
The forum follows an RBAC-like approach to restricting access to authorized users. In general, users are associated with roles and roles are associated with permissions. A user has a permission only if the user's role is associated with that permission. A user may have multiple roles.

### Roles ###
#### Visitor ####
The visitor role is the default role. A visitor is any user who has not yet been authenticated.

#### Member ####
A member is any user who has been authenticated.

#### Owner ####
The owner role is only applied within the context of a specific post. Within this context, an owner is a member who is also the author/creator of the post.

#### Administrator ####
An administrator is a member who is also tasked with performing administrative duties.

### Permissions ###
#### Read Permission ####
The read permission is associated with all roles.   
The read permission allows the user to view information on the forum.

#### Write Permission ####
The write permission is associated with the following roles: Member, Owner, Administrator.   
The write permission allows a user to create a new post on an existing thread or to create a new thread by authoring said threads original post.

#### Edit Permission ####
The edit permission is associated with the folowing roles: Owner, Administrator.   
The edit permission allows a user to edit posts so long as the thread which they are a part of is not frozen.

#### Freeze Permission ####
The freeze permission is associted with the following roles: Administrator.   
The freeze permission allows a user to freeze or unfreeze any thread at any time.



## Storage ##
All of the forums content is to be stored in a git repository. For organization in git, threads themselves should be folders where each post in a thread is a file in that folder. A subthread is a thread folder inside another thread folder. A thread may have many subthreads but a subthread may not itself have a subthread. All commits to the github respository are done on behalf of the author by the github user set up by an Administrator.

The point of this storage system is all of discussion becomes part of public record, accessible to anyone. The history is accessible like wikipedia, but is not isolated in some "talk" page, and hidden in some private db.
