DROP VIEW IF EXISTS test_view;
CREATE VIEW test_view AS
  select * from {{table}};
