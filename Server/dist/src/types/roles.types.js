"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_ROLES = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["STUDENT"] = "student";
    UserRole["SCHOOL"] = "school";
    UserRole["COLLEGE"] = "college";
    UserRole["MENTOR"] = "mentor";
    UserRole["INVESTOR"] = "investor";
    UserRole["RECRUITER"] = "recruiter";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
exports.USER_ROLES = Object.values(UserRole);
