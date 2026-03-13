jest.mock("../../src/services/auth.services", () => ({
  registerUserService: jest.fn(),
  loginUserService: jest.fn()
}));

const authServices = require("../../src/services/auth.services");
const authController = require("../../src/controllers/auth.controller");

describe("Auth Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loginUser", () => {
    test("should set cookie and return user payload on successful login", async () => {
      authServices.loginUserService.mockResolvedValueOnce({
        status: true,
        data: {
          role: "admin",
          email: "test@gmail.com",
          name: "Test User",
          token: "signed-token"
        },
        message: "You have logged in successfully"
      });

      const req = {
        body: {
          email: "test@gmail.com",
          password: "correct-password"
        }
      };
      const res = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const next = jest.fn();

      await authController.loginUser(req, res, next);

      expect(authServices.loginUserService).toHaveBeenCalledWith(req.body);
      expect(res.cookie).toHaveBeenCalledWith("token", "signed-token", {
        httpOnly: true,
        secure: true,
        sameSite: "none"
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        status: true,
        user: {
          role: "admin",
          email: "test@gmail.com",
          name: "Test User"
        },
        message: "You have logged in successfully",
        token: "signed-token"
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should forward service errors to next middleware", async () => {
      authServices.loginUserService.mockResolvedValueOnce({
        status: false,
        message: "The password you entered is incorrect"
      });

      const req = {
        body: {
          email: "test@gmail.com",
          password: "wrong-password"
        }
      };
      const res = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const next = jest.fn();

      await authController.loginUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const errorArg = next.mock.calls[0][0];
      expect(errorArg.message).toBe("The password you entered is incorrect");
      expect(errorArg.statuscode).toBe(400);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
