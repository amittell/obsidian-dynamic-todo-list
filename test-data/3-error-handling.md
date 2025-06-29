# Error Handling Test Cases

## Valid Tasks (Should be detected)
- #tasks Normal task
- [ ] #tasks Normal checkbox task
- [x] #tasks Completed task

## Malformed Tasks (Should be handled gracefully)
-#tasks Missing space after dash
- [ #tasks Missing closing bracket
- [x] tasks Missing hash
- [ ] #tasks Incomplete [
- ] #tasks Incomplete bracket
#tasks Missing list marker
- [y] #tasks Invalid checkbox state

## Mixed Content
This is regular text
- #tasks Valid task mixed in
More regular text
- [x] #tasks Another valid task
- [ ] tasks Invalid but shouldn't crash
- #tasks Final valid task